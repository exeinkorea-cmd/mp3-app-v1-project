// F:\mp3-app\mp3-app-v1-project\packages\functions\src\index.ts

import { onRequest } from "firebase-functions/v2/https";
import { onSchedule } from "firebase-functions/v2/scheduler";
import { onCall } from "firebase-functions/v2/https";
import { onDocumentCreated } from "firebase-functions/v2/firestore";
import * as logger from "firebase-functions/logger";
import * as functions from "firebase-functions";
import * as admin from "firebase-admin";
import { FieldValue, WriteBatch } from "firebase-admin/firestore";
// cors는 lazy loading으로 변경 (배포 타임아웃 방지)
// GoogleGenerativeAI는 lazy loading으로 변경 (배포 타임아웃 방지)

// ============================================================================
// [Critical Fix] Google Cloud 권장: Standard Global Initialization
// 전역 스코프에서 무조건 초기화합니다. (조건문 없이 강제 실행)
// ============================================================================
admin.initializeApp();

// 전역 인스턴스 사용 가능 (반드시 initializeApp 이후에 선언)
const db = admin.firestore();
const auth = admin.auth();

// ============================================================================
// 1. Firebase Admin 초기화 완료
// (전역 초기화는 파일 최상단에서 이미 수행됨)
// ============================================================================

// CORS 설정 (완전한 Lazy Initialization - 배포 타임아웃 방지)
let corsHandlerInstance: any | null = null;
function getCorsHandler() {
  if (!corsHandlerInstance) {
    // cors import도 동적으로 처리
    const corsModule = require("cors");
    corsHandlerInstance = corsModule({
      origin: true,
      credentials: true,
    });
  }
  return corsHandlerInstance;
}

// ============================================================================
// 2. 유틸리티 및 상수
// ============================================================================

// 번역할 목표 언어 리스트
const TARGET_LANGUAGES = ["en", "zh", "ru", "vi"];

// 현장 설정 인터페이스
interface SiteConfig {
  center: {
    latitude: number;
    longitude: number;
  };
  allowedRadiusMeters: number;
}

// 기본 현장 설정 (설정이 없을 때 사용)
const DEFAULT_SITE_CONFIG: SiteConfig = {
  center: { latitude: 37.536111, longitude: 126.833333 },
  allowedRadiusMeters: 500,
};

// 두 좌표 간 거리 계산 (Haversine 공식)
const calculateDistance = (
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number
): number => {
  const R = 6371000;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
};

// ============================================================================
// 3. Cloud Functions 정의
// ============================================================================

/**
 * 텍스트 번역 함수 (Gemini가 아닌 Google Translate API 사용)
 */
export const testTranslateV2 = onRequest(
  { region: "us-central1" },
  async (request, response) => {
    getCorsHandler()(request, response, async () => {
      try {
        const { text } = request.body;
        if (!text) {
          response.status(400).json({ error: "No text provided" });
          return;
        }

        // 동적 import
        const { v2 } = await import("@google-cloud/translate");
        const translate = new v2.Translate();

        const promises = TARGET_LANGUAGES.map((lang) =>
          translate.translate(text, lang)
        );
        const results = await Promise.all(promises);

        const translations: Record<string, string> = {};
        results.forEach((result, index) => {
          translations[TARGET_LANGUAGES[index]] = result[0];
        });

        response.status(200).json({ translatedObject: translations });
      } catch (error) {
        logger.error("Translation Error:", error);
        response.status(500).json({ error: "Internal Server Error" });
      }
    });
  }
);

/**
 * 일일 초기화 로직 (내부 함수)
 */
async function performDailyReset(): Promise<void> {
  logger.info("일일 초기화 작업 시작");
  // 전역 변수 db, auth 사용

  try {
    // 1. authCheckIns 삭제 및 세션 무효화
    try {
      const checkInsSnapshot = await db.collection("authCheckIns").get();
      const batches: WriteBatch[] = [];
      let currentBatch = db.batch();
      let count = 0;

      checkInsSnapshot.docs.forEach((doc, i) => {
        currentBatch.delete(doc.ref);
        count++;
        if (count >= 400 || i === checkInsSnapshot.docs.length - 1) {
          // 안전하게 400개로 제한
          batches.push(currentBatch);
          if (i < checkInsSnapshot.docs.length - 1) {
            currentBatch = db.batch();
            count = 0;
          }
        }
      });
      if (batches.length > 0) {
        await Promise.all(batches.map((b) => b.commit()));
      }

      // 세션 무효화
      let nextPageToken: string | undefined;
      do {
        const listUsers = await auth.listUsers(1000, nextPageToken);
        await Promise.all(
          listUsers.users.map((u) =>
            auth.revokeRefreshTokens(u.uid).catch((e) => logger.error(e))
          )
        );
        nextPageToken = listUsers.pageToken;
      } while (nextPageToken);
    } catch (e) {
      logger.error("authCheckIns Reset Error:", e);
    }

    // 2. 공지사항 등 나머지 컬렉션 삭제 (공통 로직으로 처리)
    const collectionsToDelete = [
      "bulletins",
      "emergencyAlerts",
      "siteStatusLogs",
      "checkoutPrompts",
    ];
    for (const colName of collectionsToDelete) {
      try {
        const snapshot = await db.collection(colName).get();
        const batches: WriteBatch[] = [];
        let currentBatch = db.batch();
        let count = 0;

        snapshot.docs.forEach((doc, i) => {
          // bulletins의 경우 지속 메시지 체크
          if (colName === "bulletins") {
            const data = doc.data();
            if (data.isPersistent && data.expiryDate) {
              const expiryDate = data.expiryDate.toDate();
              const now = new Date();
              if (expiryDate > now) {
                return; // 지속 메시지이고 만료일이 지나지 않았으면 삭제하지 않음
              }
            }
          }

          currentBatch.delete(doc.ref);
          count++;
          if (count >= 400 || i === snapshot.docs.length - 1) {
            batches.push(currentBatch);
            if (i < snapshot.docs.length - 1) {
              currentBatch = db.batch();
              count = 0;
            }
          }
        });

        if (batches.length > 0) {
          await Promise.all(batches.map((b) => b.commit()));
        }
        logger.info(`${colName} 컬렉션 삭제 완료`);
      } catch (e) {
        logger.error(`${colName} 삭제 오류:`, e);
      }
    }

    logger.info("일일 초기화 작업 완료");
  } catch (error) {
    logger.error("일일 초기화 작업 중 오류 발생:", error);
    throw error;
  }
}

/**
 * 매일 오후 8시 (한국시간)에 실행되는 스케줄 함수
 */
export const dailyResetAt4PM = onSchedule(
  {
    schedule: "0 11 * * *", // UTC 11시 = 한국시간 오후 8시 (UTC+9)
    timeZone: "Asia/Seoul",
    region: "us-central1",
  },
  async (event) => {
    logger.info("오후 8시 일일 초기화 작업 시작");
    await performDailyReset();
  }
);

/**
 * 관리자용 데이터 초기화 (커뮤니케이션 데이터만)
 * - 기능: 공지사항(일반), 알림, 메시지, 요청 등 커뮤니케이션 관련 데이터 삭제
 * - 보존: 장기 보관 공지사항(isPersistent=true), 조직 정보(departments), 출석 데이터(authCheckIns)
 * - 목적: 일일/주간 데이터 정리 및 UI 과부하 방지
 * - 전역 초기화: Google Cloud 권장 Standard Global Initialization 패턴 사용
 */
export const manualResetData = onCall(
  { region: "us-central1" },
  async (request) => {
    logger.info("🔥 [System] 데이터 초기화 프로세스 시작");

    try {
      // 1. 인증 확인
      if (!request.auth) {
        throw new functions.https.HttpsError(
          "unauthenticated",
          "인증이 필요합니다."
        );
      }

      const userEmail = request.auth.token.email || "관리자";
      logger.info(`데이터 초기화 요청: ${userEmail}`);

      let totalDeleted = 0;

      // ==================================================================
      // 1단계: bulletins (공지사항) - 조건부 삭제
      // ==================================================================
      try {
        const bulletinsSnapshot = await db.collection("bulletins").get();
        if (!bulletinsSnapshot.empty) {
          const MAX_BATCH_SIZE = 400;
          const batches: Promise<any>[] = [];
          let batch = db.batch();
          let count = 0;
          let deletedCount = 0;
          let preservedCount = 0;

          for (const doc of bulletinsSnapshot.docs) {
            const data = doc.data();
            // isPersistent가 true인 문서는 보존
            if (data.isPersistent === true) {
              preservedCount++;
              continue; // 삭제하지 않음
            }

            // isPersistent가 false이거나 없는 문서만 삭제
            batch.delete(doc.ref);
            count++;
            deletedCount++;

            if (count >= MAX_BATCH_SIZE) {
              batches.push(batch.commit());
              batch = db.batch();
              count = 0;
            }
          }

          // 마지막 배치 처리
          if (count > 0) {
            batches.push(batch.commit());
          }

          if (batches.length > 0) {
            await Promise.all(batches);
          }

          totalDeleted += deletedCount;
          logger.info(
            `✅ bulletins: ${deletedCount}건 삭제, ${preservedCount}건 보존`
          );
        }
      } catch (error) {
        logger.error("bulletins 삭제 중 오류:", error);
        // 개별 컬렉션 오류는 전체 프로세스를 중단하지 않음
      }

      // ==================================================================
      // 2단계: 전체 삭제 대상 컬렉션들
      // ==================================================================
      const collectionsToDelete = [
        "emergencyAlerts",
        "checkoutPrompts",
        "siteStatusLogs",
        "teamRequests",
      ];

      for (const colName of collectionsToDelete) {
        try {
          const snapshot = await db.collection(colName).get();
          if (snapshot.empty) {
            logger.info(`${colName}: 삭제할 데이터 없음`);
            continue;
          }

          const MAX_BATCH_SIZE = 400;
          const batches: Promise<any>[] = [];
          let batch = db.batch();
          let count = 0;

          for (const doc of snapshot.docs) {
            batch.delete(doc.ref);
            count++;

            if (count >= MAX_BATCH_SIZE) {
              batches.push(batch.commit());
              batch = db.batch();
              count = 0;
            }
          }

          // 마지막 배치 처리
          if (count > 0) {
            batches.push(batch.commit());
          }

          if (batches.length > 0) {
            await Promise.all(batches);
          }

          totalDeleted += snapshot.size;
          logger.info(`${colName} 컬렉션 ${snapshot.size}건 삭제 완료`);
        } catch (error) {
          logger.error(`${colName} 컬렉션 정리 실패:`, error);
          // 개별 컬렉션 오류는 전체 프로세스를 중단하지 않음
        }
      }

      logger.info(`✅ 데이터 초기화 작업 완료: 총 ${totalDeleted}건 삭제`);
      return {
        success: true,
        message: `총 ${totalDeleted}건의 데이터가 초기화되었습니다. (장기 보관 공지와 조직 정보는 유지되었습니다.)`,
        deletedCount: totalDeleted,
      };
    } catch (error) {
      logger.error("❌ 초기화 작업 치명적 오류:", error);
      throw new functions.https.HttpsError(
        "internal",
        "서버 처리 중 오류 발생",
        JSON.stringify(error)
      );
    }
  }
);

/**
 * 전체 사용자 강제 로그아웃 (데이터 삭제 방식)
 * - 기능: authCheckIns 컬렉션의 모든 문서를 삭제하여 강제 로그아웃 처리
 * - 데이터: 출석 데이터를 완전히 삭제 (모바일 앱에서 문서 삭제 감지하여 로그아웃)
 * - 전역 초기화: Google Cloud 권장 Standard Global Initialization 패턴 사용
 */
export const manualRevokeSessions = onCall(
  { region: "us-central1" },
  async (request) => {
    logger.info("🔥 [System] 전체 강제 로그아웃 프로세스 시작");

    try {
      // 1. authCheckIns 컬렉션 모든 문서 조회
      const snapshot = await db.collection("authCheckIns").get();

      if (snapshot.empty) {
        logger.info("✅ 삭제할 출석 데이터가 없습니다.");
        return {
          success: true,
          message: "삭제할 출석 데이터가 없습니다.",
          deletedCount: 0,
        };
      }

      logger.info(`📊 조회된 문서 수: ${snapshot.size}개`);

      // 2. 배치 삭제 (Batch Chunking - 400개 제한)
      const MAX_BATCH_SIZE = 400;
      const batches: Promise<any>[] = [];
      let batch = db.batch();
      let count = 0;

      for (const doc of snapshot.docs) {
        batch.delete(doc.ref);
        count++;
        if (count >= MAX_BATCH_SIZE) {
          batches.push(batch.commit());
          batch = db.batch();
          count = 0;
        }
      }
      if (count > 0) {
        batches.push(batch.commit());
      }

      // 3. 실행
      logger.info(`🚀 ${batches.length}개의 배치를 병렬로 실행합니다.`);
      await Promise.all(batches);
      logger.info(`✅ 총 ${snapshot.size}명의 데이터 삭제 완료`);

      return {
        success: true,
        message: "전체 로그아웃 및 초기화 완료",
        deletedCount: snapshot.size,
      };
    } catch (error) {
      logger.error("❌ 처리 실패:", error);
      throw new functions.https.HttpsError(
        "internal",
        "서버 처리 중 오류 발생",
        JSON.stringify(error)
      );
    }
  }
);

/**
 * 기타 소속 사용자 강제 로그아웃 (데이터 삭제 방식)
 * - 기능: authCheckIns 컬렉션에서 "기타" 소속 사용자의 모든 문서를 삭제하여 강제 로그아웃 처리
 * - 데이터: 출석 데이터를 완전히 삭제 (모바일 앱에서 문서 삭제 감지하여 로그아웃)
 * - 전역 초기화: Google Cloud 권장 Standard Global Initialization 패턴 사용
 */
export const manualRevokeOthersSessions = onCall(
  { region: "us-central1" },
  async (request) => {
    logger.info("🔥 [System] 기타 소속 사용자 강제 로그아웃 프로세스 시작");

    try {
      // 1. 인증 확인
      if (!request.auth) {
        throw new functions.https.HttpsError(
          "unauthenticated",
          "인증이 필요합니다."
        );
      }

      // 2. "기타" 소속 사용자만 필터링하여 조회
      const snapshot = await db
        .collection("authCheckIns")
        .where("department", "==", "기타")
        .get();

      if (snapshot.empty) {
        logger.info("✅ 삭제할 기타 소속 출석 데이터가 없습니다.");
        return {
          success: true,
          message: "삭제할 기타 소속 출석 데이터가 없습니다.",
          deletedCount: 0,
        };
      }

      logger.info(`📊 조회된 기타 소속 문서 수: ${snapshot.size}개`);

      // 3. 배치 삭제 (Batch Chunking - 400개 제한)
      const MAX_BATCH_SIZE = 400;
      const batches: Promise<any>[] = [];
      let batch = db.batch();
      let count = 0;

      for (const doc of snapshot.docs) {
        batch.delete(doc.ref);
        count++;
        if (count >= MAX_BATCH_SIZE) {
          batches.push(batch.commit());
          batch = db.batch();
          count = 0;
        }
      }
      if (count > 0) {
        batches.push(batch.commit());
      }

      // 4. 실행
      logger.info(`🚀 ${batches.length}개의 배치를 병렬로 실행합니다.`);
      await Promise.all(batches);
      logger.info(
        `✅ 총 ${snapshot.size}명의 '기타' 소속 사용자 데이터 삭제 완료`
      );

      return {
        success: true,
        message: `총 ${snapshot.size}명의 '기타' 소속 사용자가 로그아웃되었습니다.`,
        deletedCount: snapshot.size,
      };
    } catch (error) {
      logger.error("❌ 처리 실패:", error);
      throw new functions.https.HttpsError(
        "internal",
        "서버 처리 중 오류 발생",
        JSON.stringify(error)
      );
    }
  }
);

/**
 * 출석 상태 체크 로직 (내부 함수)
 */
async function checkAttendanceStatus(checkTime: string) {
  logger.info(`${checkTime} 출석 상태 체크 시작`);
  // 전역 변수 db 사용

  try {
    // Firestore에서 현장 설정 가져오기
    let siteConfig: SiteConfig;
    try {
      const configDoc = await db
        .collection("settings")
        .doc("site_config")
        .get();
      if (configDoc.exists) {
        const configData = configDoc.data();
        siteConfig = {
          center: {
            latitude:
              configData?.center?.latitude ||
              DEFAULT_SITE_CONFIG.center.latitude,
            longitude:
              configData?.center?.longitude ||
              DEFAULT_SITE_CONFIG.center.longitude,
          },
          allowedRadiusMeters:
            configData?.allowedRadiusMeters ||
            DEFAULT_SITE_CONFIG.allowedRadiusMeters,
        };
      } else {
        siteConfig = DEFAULT_SITE_CONFIG;
        logger.warn("현장 설정이 없어 기본값을 사용합니다.");
      }
    } catch (error) {
      logger.error("현장 설정 불러오기 오류:", error);
      siteConfig = DEFAULT_SITE_CONFIG;
    }

    const checkInsSnapshot = await db.collection("authCheckIns").get();
    const activeUsers: Array<{
      docId: string;
      userId: string;
      userName: string;
      department: string;
      location?: { latitude: number; longitude: number };
      lastCheckoutPrompt?: any;
    }> = [];

    checkInsSnapshot.forEach((doc) => {
      const data = doc.data();
      if (!data.checkOutTime && data.userId && data.location) {
        activeUsers.push({
          docId: doc.id,
          userId: data.userId,
          userName: data.userName || "알 수 없음",
          department: data.department || "알 수 없음",
          location: data.location,
          lastCheckoutPrompt: data.lastCheckoutPrompt,
        });
      }
    });

    logger.info(`퇴근하지 않은 사용자: ${activeUsers.length}명`);

    const siteInsideUsers: string[] = [];
    const siteOutsideUsers: Array<{
      docId: string;
      userId: string;
      userName: string;
    }> = [];
    const autoCheckoutUsers: string[] = [];

    for (const user of activeUsers) {
      if (!user.location) continue;

      const distance = calculateDistance(
        siteConfig.center.latitude,
        siteConfig.center.longitude,
        user.location.latitude,
        user.location.longitude
      );

      if (distance <= siteConfig.allowedRadiusMeters) {
        siteInsideUsers.push(user.userName);
        logger.info(
          `${user.userName} - 현장 내부 (거리: ${Math.round(distance)}m)`
        );
      } else {
        const lastPrompt = user.lastCheckoutPrompt;
        const now = new Date();

        if (lastPrompt && lastPrompt.timestamp) {
          const promptTime = lastPrompt.timestamp.toDate();
          const timeDiff = now.getTime() - promptTime.getTime();
          const minutesDiff = timeDiff / (1000 * 60);

          if (minutesDiff >= 30) {
            logger.info(
              `${user.userName} - 30분 경과, 자동 퇴근 처리 (거리: ${Math.round(
                distance
              )}m)`
            );
            autoCheckoutUsers.push(user.userId);

            await db.collection("authCheckIns").doc(user.docId).update({
              checkOutTime: FieldValue.serverTimestamp(),
              autoCheckout: true,
              autoCheckoutReason: "현장 외부 30분 경과",
              autoCheckoutAt: FieldValue.serverTimestamp(),
            });
          } else {
            siteOutsideUsers.push({
              docId: user.docId,
              userId: user.userId,
              userName: user.userName,
            });
          }
        } else {
          siteOutsideUsers.push({
            docId: user.docId,
            userId: user.userId,
            userName: user.userName,
          });
        }
      }
    }

    if (siteInsideUsers.length > 0) {
      await db.collection("siteStatusLogs").add({
        checkTime: checkTime,
        timestamp: FieldValue.serverTimestamp(),
        status: "active",
        activeUsersCount: siteInsideUsers.length,
        activeUsers: siteInsideUsers,
        message: `현재 현장에 미퇴근자 ${siteInsideUsers.length}명 있습니다`,
      });
      logger.info(
        `현장 내부 사용자 ${siteInsideUsers.length}명 - siteStatusLogs에 기록`
      );
    }

    for (const user of siteOutsideUsers) {
      await db.collection("checkoutPrompts").add({
        userId: user.userId,
        userName: user.userName,
        timestamp: FieldValue.serverTimestamp(),
        message: "퇴근 하시겠습니까?",
        status: "pending",
        checkTime: checkTime,
      });

      await db
        .collection("authCheckIns")
        .doc(user.docId)
        .update({
          lastCheckoutPrompt: {
            timestamp: FieldValue.serverTimestamp(),
            checkTime: checkTime,
          },
        });

      logger.info(`${user.userName} - 퇴근 확인 알림 발송`);
    }

    logger.info(
      `${checkTime} 체크 완료 - 현장 내부: ${siteInsideUsers.length}명, 현장 외부 알림: ${siteOutsideUsers.length}명, 자동 퇴근: ${autoCheckoutUsers.length}명`
    );
  } catch (error) {
    logger.error(`${checkTime} 출석 상태 체크 오류:`, error);
    throw error;
  }
}

/**
 * 매일 16:30에 실행되는 스마트 퇴근 체크 함수
 */
export const checkAttendanceStatus1630 = onSchedule(
  {
    schedule: "30 7 * * *", // UTC 7:30 = 한국시간 16:30 (UTC+9)
    timeZone: "Asia/Seoul",
    region: "us-central1",
  },
  async (event) => {
    await checkAttendanceStatus("16:30");
  }
);

/**
 * 매일 17:00에 실행되는 스마트 퇴근 체크 함수
 */
export const checkAttendanceStatus1700 = onSchedule(
  {
    schedule: "0 8 * * *", // UTC 8:00 = 한국시간 17:00 (UTC+9)
    timeZone: "Asia/Seoul",
    region: "us-central1",
  },
  async (event) => {
    await checkAttendanceStatus("17:00");
  }
);

/**
 * 매일 17:30에 실행되는 스마트 퇴근 체크 함수
 */
export const checkAttendanceStatus1730 = onSchedule(
  {
    schedule: "30 8 * * *", // UTC 8:30 = 한국시간 17:30 (UTC+9)
    timeZone: "Asia/Seoul",
    region: "us-central1",
  },
  async (event) => {
    await checkAttendanceStatus("17:30");
  }
);

/**
 * 챗봇 출석 쿼리 분석 함수 (Gemini 2.0 Flash)
 */
export const analyzeAttendanceQuery = onCall(
  {
    region: "us-central1",
  },
  async (request) => {
    const userQuery = request.data.text;
    logger.info(`📡 [AI 요청] 사용자 질문: "${userQuery}"`);

    if (!userQuery) {
      throw new Error("질문 텍스트가 필요합니다.");
    }

    try {
      const apiKey = process.env.GEMINI_API_KEY;
      if (!apiKey) {
        logger.error("❌ GEMINI_API_KEY가 설정되지 않았습니다!");
        throw new Error("Server API Key missing");
      }
      logger.info(`🔑 API Key 상태: ${apiKey.substring(0, 5)}...`);

      // GoogleGenerativeAI lazy loading (배포 타임아웃 방지)
      const { GoogleGenerativeAI } = await import("@google/generative-ai");
      const genAI = new GoogleGenerativeAI(apiKey);
      const model = genAI.getGenerativeModel({
        model: "gemini-2.0-flash-exp",
        generationConfig: {
          responseMimeType: "application/json",
        },
      });

      const systemPrompt = `
당신은 건설 현장 출석 데이터 관리 AI입니다. 
사용자의 질문을 분석하여 아래 JSON 스키마에 맞춰 응답하세요.

[사용 가능한 필드]
- userName (이름)
- phoneNumber (전화번호)
- department (소속)
- timestamp (출근시간)
- checkOutTime (퇴근시간)
- highRiskWork (고위험 작업)
- noticeConfirmed (공지 확인 여부)
- noticeTitle (공지 제목)

[응답 형식]
{
  "columns": ["userName", "department", "timestamp"],
  "filter": { "department": "삼성물산" },
  "sortBy": "timestamp",
  "sortOrder": "desc",
  "message": "삼성물산 직원들의 출근 기록입니다."
}

[중요 규칙 - 공지 관련 컬럼 포함]
사용자가 "이름", "회사", "팀", "소속", "업체" 등으로 특정 사용자나 그룹을 검색하는 경우:
- **반드시 columns 배열에 "noticeTitle"과 "noticeConfirmed"를 포함**하세요.
- 예: "홍길동", "삼성물산", "건설팀" 등으로 검색하는 경우
- filter 객체에 userName, department, company, team 등이 포함된 경우도 해당됩니다.

[시간 필터링 규칙]
timestamp 또는 checkOutTime 필드에 시간 조건을 적용할 때는 다음 형식을 사용하세요:
- "before:09:00" - 9시 이전 (예: "오전 9시 이전에 출근한 사람")
- "after:09:00" - 9시 이후 (예: "9시 이후에 출근한 사람")
- "09:00-12:00" - 9시부터 12시까지 (예: "9시부터 12시 사이에 출근한 사람")
- "at:09:00" - 정확히 9시 (예: "정확히 9시에 출근한 사람")

예시:
- "오전 9시 이전에 출근한 사람만 보여줘" → filter: { "timestamp": "before:09:00" }
- "9시 이후에 출근한 사람" → filter: { "timestamp": "after:09:00" }
- "9시부터 10시 사이에 출근한 사람" → filter: { "timestamp": "09:00-10:00" }

[규칙]
1. 질문과 가장 연관성 높은 컬럼만 columns 배열에 담으세요.
2. **이름/회사/팀 검색인 경우 noticeTitle과 noticeConfirmed를 반드시 포함**하세요.
3. 찾으려는 조건이 명확하면 filter 객체에 담으세요. (없으면 빈 객체 {})
4. 시간 관련 질문이면 반드시 위의 시간 필터링 형식을 사용하세요.
5. 정렬이 필요하면 sortBy와 sortOrder를 지정하세요. (기본: timestamp, desc)
6. message는 한국어로 사용자에게 보여줄 요약 메시지입니다.

사용자 질문: ${userQuery}

위 규칙에 따라 JSON만 반환하세요.`;

      const result = await model.generateContent(
        `${systemPrompt}\n\n사용자 질문: ${userQuery}`
      );
      const responseText = result.response.text();

      logger.info("🤖 [AI 원본 응답]:", responseText);

      const cleanedText = responseText.replace(/```json|```/g, "").trim();
      const parsedResponse = JSON.parse(cleanedText);
      return parsedResponse;
    } catch (error) {
      logger.error("❌ AI 분석/파싱 실패 상세:", error);
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      throw new Error(`분석 중 오류가 발생했습니다: ${errorMessage}`);
    }
  }
);

/**
 * 공지 조회 전용 챗봇 함수 (Cloud Functions)
 * 이름/회사명/팀명으로 검색하여 공지 내용과 확인 여부를 조회
 */
export const analyzeNoticeStatusQuery = onCall(
  {
    region: "us-central1",
  },
  async (request) => {
    const userQuery = request.data.text;
    logger.info(`📡 [공지 조회 요청] 사용자 질문: "${userQuery}"`);

    if (!userQuery) {
      throw new Error("질문 텍스트가 필요합니다.");
    }

    try {
      const apiKey = process.env.GEMINI_API_KEY;
      if (!apiKey) {
        logger.error("❌ GEMINI_API_KEY가 설정되지 않았습니다!");
        throw new Error("Server API Key missing");
      }

      // GoogleGenerativeAI lazy loading
      const { GoogleGenerativeAI } = await import("@google/generative-ai");
      const genAI = new GoogleGenerativeAI(apiKey);
      const model = genAI.getGenerativeModel({
        model: "gemini-2.0-flash-exp",
      });

      // authCheckIns에서 공지 데이터 조회
      const checkInsSnapshot = await db.collection("authCheckIns").get();
      const noticeData: any[] = [];

      const searchLower = userQuery.toLowerCase().trim();

      checkInsSnapshot.forEach((doc) => {
        const data = doc.data();
        const userName = data.userName || "";
        const department = data.department || "";

        // department 파싱
        let company: string | undefined;
        let team: string | undefined;

        if (department.includes(" - ")) {
          const parts = department.split(" - ");
          company = parts[0];
          team = parts[1];
        } else {
          company = department;
        }

        // 검색 조건 매칭
        const matchesName = userName.toLowerCase().includes(searchLower);
        const matchesCompany = company?.toLowerCase().includes(searchLower);
        const matchesTeam = team?.toLowerCase().includes(searchLower);
        const matchesDepartment = department
          .toLowerCase()
          .includes(searchLower);

        if (
          !matchesName &&
          !matchesCompany &&
          !matchesTeam &&
          !matchesDepartment
        ) {
          return;
        }

        // noticeHistory 처리
        const noticeHistory = data.noticeHistory || [];
        const allNotices = noticeHistory.map((notice: any) => ({
          title: notice.title,
          confirmed: notice.confirmed,
          sentAt: notice.sentAt
            ? notice.sentAt.toDate().toLocaleString("ko-KR")
            : "알 수 없음",
        }));

        // 최신 공지
        const sortedNotices = [...noticeHistory].sort((a: any, b: any) => {
          const aTime = a.sentAt?.toMillis() || 0;
          const bTime = b.sentAt?.toMillis() || 0;
          return bTime - aTime;
        });

        const latestNotice = sortedNotices[0];
        const latestNoticeTitle = latestNotice?.title || "공지 없음";
        const latestNoticeSentAt = latestNotice?.sentAt
          ? latestNotice.sentAt.toDate().toLocaleString("ko-KR")
          : null;
        const noticeConfirmed = latestNotice?.confirmed || false;

        noticeData.push({
          userName,
          department,
          company,
          team,
          latestNoticeTitle,
          latestNoticeSentAt,
          noticeConfirmed,
          allNotices,
        });
      });

      if (noticeData.length === 0) {
        return {
          message: `"${userQuery}"에 해당하는 사용자를 찾을 수 없습니다.`,
          table: null,
        };
      }

      // System Prompt
      const systemPrompt = `당신은 건설 현장 공지사항 관리 AI입니다.
사용자의 질문에 대해 **반드시 마크다운 테이블 형식**으로 답변해야 합니다.

[데이터 구조]
각 사용자별로 다음 정보가 제공됩니다:
- userName: 사용자 이름
- department: 소속 (형식: "회사명 - 팀명" 또는 "회사명")
- company: 회사명
- team: 팀명 (있을 경우)
- latestNoticeTitle: 최신 공지 제목
- latestNoticeSentAt: 최신 공지 발송 시간
- noticeConfirmed: 확인 여부 (true/false)
- allNotices: 모든 공지 목록

[응답 규칙]
1. **반드시 마크다운 테이블을 가장 먼저 표시**하세요.
2. 테이블 컬럼: | 이름 | 소속 | 공지 내용 | 확인 여부 |
3. 확인 여부는 "✅ 확인" 또는 "❌ 미확인"으로 표시하세요.
4. 테이블 다음에 간단한 요약 설명을 추가할 수 있습니다 (1-2줄).
5. 서술형 답변은 최소화하고, 테이블이 핵심입니다.

[테이블 예시]
| 이름 | 소속 | 공지 내용 | 확인 여부 |
|------|------|----------|----------|
| 홍길동 | 삼성물산 - 건설팀 | 아침 안전조회 전달사항 | ✅ 확인 |
| 김철수 | 현대건설 - 시공팀 | 금일 주요작업 안내 | ❌ 미확인 |

공지 데이터:
${JSON.stringify(noticeData, null, 2)}

사용자 질문: ${userQuery}

위 규칙에 따라 **마크다운 테이블을 가장 먼저** 표시하여 답변하세요.`;

      const result = await model.generateContent(systemPrompt);
      const responseText = result.response.text();

      logger.info("🤖 [AI 원본 응답]:", responseText);

      return {
        message: responseText,
        table: noticeData, // 원본 데이터도 함께 반환 (필요시)
      };
    } catch (error) {
      logger.error("❌ 공지 조회 실패:", error);
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      throw new Error(`공지 조회 중 오류가 발생했습니다: ${errorMessage}`);
    }
  }
);

/**
 * 긴급 알림 생성 시 자동으로 공지사항 생성
 * emergencyAlerts 컬렉션에 "fire" 타입 문서가 생성되면
 * 모든 사용자에게 긴급 공지사항을 자동 생성합니다.
 */
export const onEmergencyAlertCreated = onDocumentCreated(
  {
    document: "emergencyAlerts/{alertId}",
    region: "us-central1",
  },
  async (event) => {
    // 전역 변수 db 사용
    const alertData = event.data?.data();

    if (!alertData) {
      logger.warn("알림 데이터가 없습니다.");
      return;
    }

    // "fire" 타입인 경우에만 공지사항 생성
    if (alertData.type === "fire") {
      try {
        // 다국어 제목 및 내용
        const titleTranslations = {
          ko: "긴급! 화재 발생",
          en: "Emergency! Fire Alert",
          zh: "紧急！火灾警报",
          vi: "Khẩn cấp! Báo cháy",
          ru: "Срочно! Пожарная тревога",
        };

        const contentTranslations = {
          ko: "현장에 화재가 발생했습니다. 즉시 대피하십시오.",
          en: "A fire has occurred at the site. Evacuate immediately.",
          zh: "现场发生火灾。请立即撤离。",
          vi: "Đã xảy ra hỏa hoạn tại hiện trường. Sơ tán ngay lập tức.",
          ru: "На объекте произошел пожар. Немедленно эвакуируйтесь.",
        };

        // bulletins 컬렉션에 긴급 공지사항 생성
        await db.collection("bulletins").add({
          title: titleTranslations.ko,
          originalText: contentTranslations.ko,
          titleTranslations: titleTranslations,
          contentTranslations: contentTranslations,
          targetType: "all",
          targetValues: [],
          isPersistent: true, // 상단 고정
          createdAt: FieldValue.serverTimestamp(),
          createdBy: "system",
          emergencyAlertId: event.params.alertId, // 원본 알림 ID 참조
        });

        logger.info(
          `긴급 화재 공지사항이 생성되었습니다. 알림 ID: ${event.params.alertId}`
        );
      } catch (error) {
        logger.error("긴급 공지사항 생성 오류:", error);
      }
    } else {
      logger.info(
        `알림 타입 "${alertData.type}"은 공지사항을 생성하지 않습니다.`
      );
    }
  }
);
