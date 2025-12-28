// F:\mp3-app\mp3-app-v1-project\packages\functions\src\index.ts

import { onRequest } from "firebase-functions/v2/https";
import { onSchedule } from "firebase-functions/v2/scheduler";
import { onCall } from "firebase-functions/v2/https";
import { onDocumentCreated } from "firebase-functions/v2/firestore";
import * as logger from "firebase-functions/logger";
import * as functions from "firebase-functions";
import * as admin from "firebase-admin";
import { FieldValue } from "firebase-admin/firestore";
import { getStorage } from "firebase-admin/storage";
import * as XLSX from "xlsx";
// cors는 lazy loading으로 변경 (배포 타임아웃 방지)
// GoogleGenerativeAI는 lazy loading으로 변경 (배포 타임아웃 방지)

// ============================================================================
// [Critical Fix] Google Cloud 권장: Standard Global Initialization
// 전역 스코프에서 무조건 초기화합니다. (조건문 없이 강제 실행)
// 중복 초기화 방지를 위해 try-catch 추가
// ============================================================================
try {
  admin.initializeApp();
} catch (error: any) {
  // 이미 초기화된 경우 무시
  if (error.code !== "app/duplicate-app") {
    throw error;
  }
}

// 전역 인스턴스 사용 가능 (반드시 initializeApp 이후에 선언)
const db = admin.firestore();

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
 * - 강제로그아웃 버튼 + 데이터초기화 버튼의 기능을 합친 것과 동일
 */
async function performDailyReset(): Promise<void> {
  logger.info("일일 초기화 작업 시작");
  // 전역 변수 db, auth 사용

  try {
    // ==================================================================
    // 1단계: authCheckIns 삭제 (강제로그아웃 버튼과 동일)
    // ==================================================================
    try {
      const checkInsSnapshot = await db.collection("authCheckIns").get();

      if (!checkInsSnapshot.empty) {
        const MAX_BATCH_SIZE = 400;
        const batches: Promise<any>[] = [];
        let batch = db.batch();
        let count = 0;

        for (const doc of checkInsSnapshot.docs) {
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

        if (batches.length > 0) {
          await Promise.all(batches);
        }
        logger.info(`✅ authCheckIns: ${checkInsSnapshot.size}건 삭제 완료`);
      } else {
        logger.info("✅ 삭제할 출석 데이터가 없습니다.");
      }
    } catch (e) {
      logger.error("authCheckIns Reset Error:", e);
    }

    // ==================================================================
    // 2단계: bulletins (공지사항) - 데이터초기화 버튼과 동일한 로직
    // isPersistent=true인 문서는 보존
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
          // isPersistent가 true인 문서는 보존 (데이터초기화 버튼과 동일)
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

        logger.info(
          `✅ bulletins: ${deletedCount}건 삭제, ${preservedCount}건 보존`
        );
      }
    } catch (e) {
      logger.error("bulletins 삭제 오류:", e);
    }

    // ==================================================================
    // 3단계: 전체 삭제 대상 컬렉션들 (데이터초기화 버튼과 동일)
    // ==================================================================
    const collectionsToDelete = [
      "emergencyAlerts",
      "checkoutPrompts",
      "siteStatusLogs",
      "teamRequests", // 데이터초기화 버튼에 포함되어 있음
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

        logger.info(`${colName} 컬렉션 ${snapshot.size}건 삭제 완료`);
      } catch (e) {
        logger.error(`${colName} 삭제 오류:`, e);
        // 개별 컬렉션 오류는 전체 프로세스를 중단하지 않음
      }
    }

    logger.info("일일 초기화 작업 완료");
  } catch (error) {
    logger.error("일일 초기화 작업 중 오류 발생:", error);
    throw error;
  }
}

/**
 * 매일 새벽 1시 (한국시간)에 실행되는 스케줄 함수
 */
export const dailyResetAt1AM = onSchedule(
  {
    schedule: "0 16 * * *", // UTC 16시 = 한국시간 새벽 1시 (UTC+9)
    timeZone: "Asia/Seoul",
    region: "us-central1",
  },
  async (event) => {
    logger.info("새벽 1시 일일 초기화 작업 시작");
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
 * 개별 사용자 로그아웃 (퇴근 처리)
 * - 기능: 특정 사용자의 authCheckIns 문서에서 checkOutTime 업데이트 및 location 삭제
 * - 데이터: 출석 데이터를 업데이트하여 퇴근 처리 (삭제하지 않음)
 * - 전역 초기화: Google Cloud 권장 Standard Global Initialization 패턴 사용
 */
export const revokeUserSession = onCall(
  { region: "us-central1" },
  async (request) => {
    logger.info("🔥 [System] 개별 사용자 로그아웃 프로세스 시작");

    try {
      const { phoneNumber } = request.data;

      if (!phoneNumber) {
        throw new functions.https.HttpsError(
          "invalid-argument",
          "전화번호가 필요합니다."
        );
      }

      logger.info(`📱 처리 대상 전화번호: ${phoneNumber}`);

      // 1. 해당 사용자의 최신 출석 레코드 찾기
      const checkInsSnapshot = await db
        .collection("authCheckIns")
        .where("phoneNumber", "==", phoneNumber)
        .orderBy("timestamp", "desc")
        .get();

      if (checkInsSnapshot.empty) {
        logger.info("✅ 처리할 출석 데이터가 없습니다.");
        return {
          success: true,
          message: "처리할 출석 데이터가 없습니다.",
          updatedCount: 0,
        };
      }

      // 2. checkOutTime이 없는 최신 레코드 찾기
      let updatedCount = 0;
      for (const docSnapshot of checkInsSnapshot.docs) {
        const data = docSnapshot.data();
        if (!data.checkOutTime) {
          // checkOutTime 업데이트 및 location 삭제
          await db.collection("authCheckIns").doc(docSnapshot.id).update({
            checkOutTime: FieldValue.serverTimestamp(),
            location: FieldValue.delete(), // GPS 정보 삭제
          });
          updatedCount = 1;
          logger.info(`✅ 사용자 퇴근 처리 완료: ${docSnapshot.id}`);
          break; // 첫 번째 레코드만 업데이트
        }
      }

      if (updatedCount === 0) {
        logger.info("✅ 이미 퇴근 처리된 사용자입니다.");
        return {
          success: true,
          message: "이미 퇴근 처리된 사용자입니다.",
          updatedCount: 0,
        };
      }

      return {
        success: true,
        message: "로그아웃 처리 완료",
        updatedCount: updatedCount,
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

            // 강제 로그아웃과 동일하게 문서 삭제
            await db.collection("authCheckIns").doc(user.docId).delete();
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
 * 매일 16:30에 실행되는 스마트 퇴근 체크 함수 (퇴근시간 16:00 + 30분)
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
 * 매일 17:00에 실행되는 스마트 퇴근 체크 함수 (퇴근시간 16:00 + 60분)
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
 * 매일 17:30에 실행되는 스마트 퇴근 체크 함수 (퇴근시간 16:00 + 90분)
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
 * 매일 18:00에 실행되는 스마트 퇴근 체크 함수 (퇴근시간 16:00 + 120분)
 */
export const checkAttendanceStatus1800 = onSchedule(
  {
    schedule: "0 9 * * *", // UTC 9:00 = 한국시간 18:00 (UTC+9)
    timeZone: "Asia/Seoul",
    region: "us-central1",
  },
  async (event) => {
    await checkAttendanceStatus("18:00");
  }
);

/**
 * 전체 근로자 GPS 확인 함수
 * authCheckIns의 모든 활성 사용자의 GPS 위치를 확인합니다.
 */
async function checkAllWorkersGPS() {
  logger.info("전체 근로자 GPS 확인 시작");

  try {
    // 1. GPS 자동 확인 설정 확인
    const configDoc = await db.collection("settings").doc("site_config").get();
    if (!configDoc.exists) {
      logger.warn("현장 설정이 없습니다.");
      return;
    }

    const configData = configDoc.data();
    if (!configData?.autoGpsCheckEnabled) {
      logger.info("GPS 자동 확인이 비활성화되어 있습니다.");
      return;
    }

    // 2. 활성 사용자 조회 (checkOutTime이 없는 사용자)
    const checkInsSnapshot = await db.collection("authCheckIns").get();
    const activeUsers: Array<{
      docId: string;
      userId: string;
      userName: string;
      location?: { latitude: number; longitude: number };
      locationUpdatedAt?: any;
    }> = [];

    checkInsSnapshot.forEach((doc) => {
      const data = doc.data();
      if (!data.checkOutTime && data.userId) {
        activeUsers.push({
          docId: doc.id,
          userId: data.userId,
          userName: data.userName || "알 수 없음",
          location: data.location,
          locationUpdatedAt: data.locationUpdatedAt || data.timestamp,
        });
      }
    });

    logger.info(`활성 사용자 수: ${activeUsers.length}명`);

    // 3. GPS 위치가 없거나 오래된 사용자 확인
    const now = new Date();
    const usersWithoutGPS: string[] = [];
    const usersWithOldGPS: string[] = [];

    for (const user of activeUsers) {
      if (!user.location) {
        usersWithoutGPS.push(user.userName);
      } else if (user.locationUpdatedAt) {
        const updatedAt = user.locationUpdatedAt.toDate();
        const hoursDiff = (now.getTime() - updatedAt.getTime()) / (1000 * 60 * 60);
        // 2시간 이상 업데이트되지 않은 경우
        if (hoursDiff >= 2) {
          usersWithOldGPS.push(user.userName);
        }
      }
    }

    // 4. 로그 기록
    if (usersWithoutGPS.length > 0 || usersWithOldGPS.length > 0) {
      await db.collection("siteStatusLogs").add({
        checkTime: "13:00",
        timestamp: FieldValue.serverTimestamp(),
        status: "active",
        activeUsersCount: activeUsers.length,
        activeUsers: activeUsers.map((u) => u.userName),
        message: `GPS 확인: 위치 없음 ${usersWithoutGPS.length}명, 오래된 위치 ${usersWithOldGPS.length}명`,
        gpsCheckResult: {
          usersWithoutGPS,
          usersWithOldGPS,
          totalActiveUsers: activeUsers.length,
        },
      });

      logger.info(
        `GPS 확인 완료 - 위치 없음: ${usersWithoutGPS.length}명, 오래된 위치: ${usersWithOldGPS.length}명`
      );
    } else {
      logger.info("모든 활성 사용자의 GPS 위치가 정상입니다.");
    }
  } catch (error) {
    logger.error("전체 근로자 GPS 확인 오류:", error);
    throw error;
  }
}

/**
 * 매일 13:00에 실행되는 전체 근로자 GPS 확인 함수
 */
export const checkAllWorkersGPSAt1PM = onSchedule(
  {
    schedule: "0 4 * * *", // UTC 4:00 = 한국시간 13:00 (UTC+9)
    timeZone: "Asia/Seoul",
    region: "us-central1",
  },
  async (event) => {
    await checkAllWorkersGPS();
  }
);

/**
 * 출석 데이터를 엑셀 파일로 백업하는 함수
 */
async function backupAttendanceDataToExcel() {
  logger.info("출석 데이터 엑셀 백업 시작");

  try {
    // 1. 백업 자동 저장 설정 확인
    const configDoc = await db.collection("settings").doc("site_config").get();
    if (!configDoc.exists) {
      logger.warn("현장 설정이 없습니다.");
      return;
    }

    const configData = configDoc.data();
    if (!configData?.autoBackupEnabled) {
      logger.info("출석 데이터 자동 백업이 비활성화되어 있습니다.");
      return;
    }

    // 2. 출석 데이터 조회
    const checkInsSnapshot = await db.collection("authCheckIns").get();
    const attendanceData: any[] = [];

    checkInsSnapshot.forEach((doc) => {
      const data = doc.data();
      attendanceData.push({
        이름: data.userName || "",
        전화번호: data.phoneNumber || "",
        소속: data.department || "",
        출근시간: data.timestamp?.toDate().toLocaleString("ko-KR") || "",
        퇴근시간: data.checkOutTime?.toDate().toLocaleString("ko-KR") || "",
        고위험작업: data.highRiskWork || "",
        공지확인: data.noticeConfirmed ? "확인" : "미확인",
        위도: data.location?.latitude || "",
        경도: data.location?.longitude || "",
      });
    });

    // 3. 엑셀 파일 생성
    const worksheet = XLSX.utils.json_to_sheet(attendanceData);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "출석데이터");

    const excelBuffer = XLSX.write(workbook, {
      type: "buffer",
      bookType: "xlsx",
    });

    // 4. Firebase Storage에 업로드
    const bucket = getStorage().bucket();
    const now = new Date();
    const dateStr = now.toISOString().split("T")[0];
    const timeStr = now.toTimeString().split(" ")[0].replace(/:/g, "-");
    const folderPath = configData.backupFolderPath || "attendance-backups";
    const fileName = `${folderPath}/attendance_${dateStr}_${timeStr}.xlsx`;

    const file = bucket.file(fileName);
    await file.save(excelBuffer, {
      metadata: {
        contentType:
          "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      },
    });

    logger.info(
      `✅ 출석 데이터 엑셀 백업 완료: ${fileName} (${attendanceData.length}건)`
    );
  } catch (error) {
    logger.error("출석 데이터 엑셀 백업 오류:", error);
    throw error;
  }
}

/**
 * 매일 10:50에 실행되는 출석 데이터 백업 함수
 */
export const backupAttendanceDataAt1050 = onSchedule(
  {
    schedule: "50 1 * * *", // UTC 1:50 = 한국시간 10:50 (UTC+9)
    timeZone: "Asia/Seoul",
    region: "us-central1",
  },
  async (event) => {
    await backupAttendanceDataToExcel();
  }
);

/**
 * 매일 13:50에 실행되는 출석 데이터 백업 함수
 */
export const backupAttendanceDataAt1350 = onSchedule(
  {
    schedule: "50 4 * * *", // UTC 4:50 = 한국시간 13:50 (UTC+9)
    timeZone: "Asia/Seoul",
    region: "us-central1",
  },
  async (event) => {
    await backupAttendanceDataToExcel();
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

/**
 * 날씨 경고 메시지 생성 함수 (다국어 지원)
 * 체감온도에 따라 적절한 경고 메시지를 다국어로 반환합니다.
 */
function getWeatherAlertMessage(feelsLike: number): {
  titleTranslations: Record<string, string>;
  contentTranslations: Record<string, string>;
} | null {
  // 폭염 경고 (높은 온도부터 체크)
  if (feelsLike >= 38) {
    return {
      titleTranslations: {
        ko: "🚨 [긴급] 폭염 위험",
        en: "🚨 [Emergency] Extreme Heat Warning",
        zh: "🚨 [紧急] 极端高温警告",
        vi: "🚨 [Khẩn cấp] Cảnh báo nắng nóng cực độ",
        ru: "🚨 [Срочно] Предупреждение об экстремальной жаре",
      },
      contentTranslations: {
        ko: `현재 체감온도가 ${feelsLike}°C입니다. 긴급 작업 외 옥외작업을 중지해주세요. (실제 현장의 체감온도와 차이가 있을 수 있습니다.)`,
        en: `Current feels-like temperature is ${feelsLike}°C. Please stop outdoor work except for emergency tasks. (The actual feels-like temperature at the site may differ.)`,
        zh: `当前体感温度为 ${feelsLike}°C。除紧急作业外，请停止户外作业。（实际现场的体感温度可能有所不同。）`,
        vi: `Nhiệt độ cảm nhận hiện tại là ${feelsLike}°C. Vui lòng dừng công việc ngoài trời ngoại trừ các nhiệm vụ khẩn cấp. (Nhiệt độ cảm nhận thực tế tại hiện trường có thể khác.)`,
        ru: `Текущая температура по ощущениям составляет ${feelsLike}°C. Пожалуйста, прекратите работу на открытом воздухе, кроме аварийных задач. (Фактическая температура по ощущениям на объекте может отличаться.)`,
      },
    };
  } else if (feelsLike >= 35 && feelsLike <= 37) {
    return {
      titleTranslations: {
        ko: "🚨 [긴급] 폭염 경고",
        en: "🚨 [Emergency] Heat Warning",
        zh: "🚨 [紧急] 高温警告",
        vi: "🚨 [Khẩn cấp] Cảnh báo nắng nóng",
        ru: "🚨 [Срочно] Предупреждение о жаре",
      },
      contentTranslations: {
        ko: `현재 체감온도가 ${feelsLike}°C입니다. 1시간마다 15분씩 그늘에서 쉬고, 가능하면 옥외작업을 피해주세요. (실제 현장의 체감온도와 차이가 있을 수 있습니다.)`,
        en: `Current feels-like temperature is ${feelsLike}°C. Please rest in the shade for 15 minutes every hour and avoid outdoor work if possible. (The actual feels-like temperature at the site may differ.)`,
        zh: `当前体感温度为 ${feelsLike}°C。请每小时在阴凉处休息15分钟，如有可能，请避免户外作业。（实际现场的体感温度可能有所不同。）`,
        vi: `Nhiệt độ cảm nhận hiện tại là ${feelsLike}°C. Vui lòng nghỉ ngơi trong bóng râm 15 phút mỗi giờ và tránh công việc ngoài trời nếu có thể. (Nhiệt độ cảm nhận thực tế tại hiện trường có thể khác.)`,
        ru: `Текущая температура по ощущениям составляет ${feelsLike}°C. Пожалуйста, отдыхайте в тени по 15 минут каждый час и по возможности избегайте работы на открытом воздухе. (Фактическая температура по ощущениям на объекте может отличаться.)`,
      },
    };
  } else if (feelsLike >= 33 && feelsLike <= 34) {
    return {
      titleTranslations: {
        ko: "🚨 [긴급] 폭염 주의",
        en: "🚨 [Emergency] Heat Caution",
        zh: "🚨 [紧急] 高温注意",
        vi: "🚨 [Khẩn cấp] Cảnh giác nắng nóng",
        ru: "🚨 [Срочно] Осторожность при жаре",
      },
      contentTranslations: {
        ko: `현재 체감온도가 ${feelsLike}°C입니다. 2시간마다 20분 이상의 휴식 부여 (혹은 1시간마다 10분 휴식 등 대체 가능). 오후 2시~5시 옥외작업 단축 또는 시간 조정을 해주세요! (실제 현장의 체감온도와 차이가 있을 수 있습니다.)`,
        en: `Current feels-like temperature is ${feelsLike}°C. Please provide at least 20 minutes of rest every 2 hours (or 10 minutes every hour as an alternative). Please reduce or adjust outdoor work hours between 2 PM and 5 PM! (The actual feels-like temperature at the site may differ.)`,
        zh: `当前体感温度为 ${feelsLike}°C。请每2小时提供至少20分钟的休息（或每小时10分钟作为替代）。请缩短或调整下午2点至5点的户外作业时间！（实际现场的体感温度可能有所不同。）`,
        vi: `Nhiệt độ cảm nhận hiện tại là ${feelsLike}°C. Vui lòng cung cấp ít nhất 20 phút nghỉ ngơi mỗi 2 giờ (hoặc 10 phút mỗi giờ như một lựa chọn thay thế). Vui lòng giảm hoặc điều chỉnh giờ làm việc ngoài trời giữa 2 giờ chiều và 5 giờ chiều! (Nhiệt độ cảm nhận thực tế tại hiện trường có thể khác.)`,
        ru: `Текущая температура по ощущениям составляет ${feelsLike}°C. Пожалуйста, предоставляйте не менее 20 минут отдыха каждые 2 часа (или 10 минут каждый час в качестве альтернативы). Пожалуйста, сократите или скорректируйте часы работы на открытом воздухе с 14:00 до 17:00! (Фактическая температура по ощущениям на объекте может отличаться.)`,
      },
    };
  } else if (feelsLike >= 31 && feelsLike <= 32) {
    return {
      titleTranslations: {
        ko: "🚨 [긴급] 폭염 주의보",
        en: "🚨 [Emergency] Heat Advisory",
        zh: "🚨 [紧急] 高温注意",
        vi: "🚨 [Khẩn cấp] Cảnh báo nắng nóng",
        ru: "🚨 [Срочно] Рекомендация по жаре",
      },
      contentTranslations: {
        ko: `현재 체감온도가 ${feelsLike}°C입니다. 냉방, 통풍, 작업시간 조정, 주기적 휴식 등 폭염 노출에 주의해주세요! (실제 현장의 체감온도와 차이가 있을 수 있습니다.)`,
        en: `Current feels-like temperature is ${feelsLike}°C. Please be cautious about heat exposure with air conditioning, ventilation, work schedule adjustments, and regular breaks! (The actual feels-like temperature at the site may differ.)`,
        zh: `当前体感温度为 ${feelsLike}°C。请注意防暑，包括空调、通风、工作时间调整和定期休息！（实际现场的体感温度可能有所不同。）`,
        vi: `Nhiệt độ cảm nhận hiện tại là ${feelsLike}°C. Vui lòng thận trọng về việc tiếp xúc với nắng nóng với điều hòa không khí, thông gió, điều chỉnh lịch làm việc và nghỉ ngơi thường xuyên! (Nhiệt độ cảm nhận thực tế tại hiện trường có thể khác.)`,
        ru: `Текущая температура по ощущениям составляет ${feelsLike}°C. Пожалуйста, будьте осторожны с воздействием жары, используя кондиционирование воздуха, вентиляцию, корректировку рабочего графика и регулярные перерывы! (Фактическая температура по ощущениям на объекте может отличаться.)`,
      },
    };
  }
  
  // 한파 경고 (낮은 온도부터 체크)
  else if (feelsLike <= -12) {
    return {
      titleTranslations: {
        ko: "🚨 [긴급] 한파 주의보",
        en: "🚨 [Emergency] Cold Wave Warning",
        zh: "🚨 [紧急] 寒潮警告",
        vi: "🚨 [Khẩn cấp] Cảnh báo sóng lạnh",
        ru: "🚨 [Срочно] Предупреждение о холодной волне",
      },
      contentTranslations: {
        ko: `현재 체감온도가 ${feelsLike}°C입니다. 휴게실에서 충분히 휴식을 취하고 긴급 작업 외 옥외작업을 중지해주세요. (실제 현장의 체감온도와 차이가 있을 수 있습니다.)`,
        en: `Current feels-like temperature is ${feelsLike}°C. Please rest sufficiently in the break room and stop outdoor work except for emergency tasks. (The actual feels-like temperature at the site may differ.)`,
        zh: `当前体感温度为 ${feelsLike}°C。请在休息室充分休息，除紧急作业外，请停止户外作业。（实际现场的体感温度可能有所不同。）`,
        vi: `Nhiệt độ cảm nhận hiện tại là ${feelsLike}°C. Vui lòng nghỉ ngơi đầy đủ trong phòng nghỉ và dừng công việc ngoài trời ngoại trừ các nhiệm vụ khẩn cấp. (Nhiệt độ cảm nhận thực tế tại hiện trường có thể khác.)`,
        ru: `Текущая температура по ощущениям составляет ${feelsLike}°C. Пожалуйста, достаточно отдыхайте в комнате отдыха и прекратите работу на открытом воздухе, кроме аварийных задач. (Фактическая температура по ощущениям на объекте может отличаться.)`,
      },
    };
  } else if (feelsLike >= -11 && feelsLike <= -6) {
    return {
      titleTranslations: {
        ko: "🚨 [긴급] 한파 관심",
        en: "🚨 [Emergency] Cold Wave Advisory",
        zh: "🚨 [紧急] 寒潮注意",
        vi: "🚨 [Khẩn cấp] Cảnh báo sóng lạnh",
        ru: "🚨 [Срочно] Рекомендация по холодной волне",
      },
      contentTranslations: {
        ko: `현재 체감온도가 ${feelsLike}°C입니다. 휴게실에서 충분히 휴식을 취하고 따뜻한 물을 주기적으로 섭취하세요. (실제 현장의 체감온도와 차이가 있을 수 있습니다.)`,
        en: `Current feels-like temperature is ${feelsLike}°C. Please rest sufficiently in the break room and drink warm water regularly. (The actual feels-like temperature at the site may differ.)`,
        zh: `当前体感温度为 ${feelsLike}°C。请在休息室充分休息，并定期饮用温水。（实际现场的体感温度可能有所不同。）`,
        vi: `Nhiệt độ cảm nhận hiện tại là ${feelsLike}°C. Vui lòng nghỉ ngơi đầy đủ trong phòng nghỉ và uống nước ấm thường xuyên. (Nhiệt độ cảm nhận thực tế tại hiện trường có thể khác.)`,
        ru: `Текущая температура по ощущениям составляет ${feelsLike}°C. Пожалуйста, достаточно отдыхайте в комнате отдыха и регулярно пейте теплую воду. (Фактическая температура по ощущениям на объекте может отличаться.)`,
      },
    };
  }
  
  return null;
}

/**
 * 매시간 날씨 체크 및 경고 발송
 * 매시간 정각마다 실행되어 체감온도를 확인하고 조건에 맞으면 공지사항을 발송합니다.
 */
export const checkWeatherAndSendAlert = onSchedule(
  {
    schedule: "0 * * * *", // 매시간 정각
    timeZone: "Asia/Seoul",
    region: "us-central1",
  },
  async (event) => {
    logger.info("🌤️ 날씨 체크 시작");

    try {
      // 1. 현장 설정 가져오기
      const configDoc = await db.collection("settings").doc("site_config").get();
      if (!configDoc.exists) {
        logger.warn("현장 설정이 없습니다.");
        return;
      }

      const siteConfig = configDoc.data() as {
        center: { latitude: number; longitude: number };
        allowedRadiusMeters: number;
      };

      // 2. 날씨 API 호출
      const API_KEY = "06abc1820848cca6cc759c3dba2c1c18";
      const lat = siteConfig.center.latitude;
      const lon = siteConfig.center.longitude;
      const url = `https://api.openweathermap.org/data/2.5/weather?lat=${lat}&lon=${lon}&appid=${API_KEY}&units=metric&lang=kr`;

      const response = await fetch(url);
      if (!response.ok) {
        throw new Error(`날씨 API 오류: ${response.status}`);
      }

      const data = (await response.json()) as {
        main: { feels_like: number };
      };
      const feelsLike = Math.round(data.main.feels_like);

      logger.info(`현재 체감온도: ${feelsLike}°C`);

      // 3. 경고 메시지 확인 (다국어 번역 포함)
      const alertMessage = getWeatherAlertMessage(feelsLike);
      if (!alertMessage) {
        logger.info("경고 조건에 해당하지 않습니다.");
        return;
      }

      // 4. 오늘 이미 같은 경고를 보냈는지 확인 (중복 방지)
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const todayStart = admin.firestore.Timestamp.fromDate(today);

      const existingAlerts = await db
        .collection("bulletins")
        .where("createdAt", ">=", todayStart)
        .where("title", "==", alertMessage.titleTranslations.ko)
        .where("isWeatherAlert", "==", true)
        .get();

      if (!existingAlerts.empty) {
        logger.info("오늘 이미 같은 경고를 발송했습니다. 중복 발송을 건너뜁니다.");
        return;
      }

      // 5. 공지사항 생성 (다국어 번역 포함)
      await db.collection("bulletins").add({
        title: alertMessage.titleTranslations.ko,
        originalText: alertMessage.contentTranslations.ko,
        titleTranslations: alertMessage.titleTranslations,
        contentTranslations: alertMessage.contentTranslations,
        targetType: "all",
        targetValues: [],
        isPersistent: true, // 상단 고정
        isWeatherAlert: true, // 날씨 경고 표시
        weatherAlertType: feelsLike >= 31 ? "heat" : "cold", // 폭염/한파 구분
        createdAt: FieldValue.serverTimestamp(),
        createdBy: "system",
      });

      logger.info(`✅ 날씨 경고 공지 발송 완료: ${alertMessage.titleTranslations.ko}`);
    } catch (error) {
      logger.error("날씨 체크 및 경고 발송 오류:", error);
    }
  }
);
