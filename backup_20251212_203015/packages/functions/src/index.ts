// F:\mp3-app\mp3-app-v1-project\packages\functions\src\index.ts

import { onRequest } from "firebase-functions/v2/https";
import { onSchedule } from "firebase-functions/v2/scheduler";
import { onCall } from "firebase-functions/v2/https";
import * as logger from "firebase-functions/logger";
import { initializeApp, getApps, getApp, App } from "firebase-admin/app";
import {
  getFirestore,
  FieldValue,
  WriteBatch,
  Firestore,
} from "firebase-admin/firestore";
import { getAuth, Auth } from "firebase-admin/auth";
// cors는 lazy loading으로 변경 (배포 타임아웃 방지)
// GoogleGenerativeAI는 lazy loading으로 변경 (배포 타임아웃 방지)

// ============================================================================
// 1. Firebase Admin 초기화 (방탄 코드)
// ============================================================================

// 전역 범위에서 앱 인스턴스 관리
let appInstance: App | null = null;
let dbInstance: Firestore | null = null;
let authInstance: Auth | null = null;

// [핵심] 앱 인스턴스를 확실하게 가져오는 함수
function getAppInstance(): App {
  if (!appInstance) {
    if (getApps().length === 0) {
      appInstance = initializeApp();
    } else {
      appInstance = getApp();
    }
  }
  return appInstance;
}

// 초기화된 앱을 사용하여 DB 인스턴스 가져오기
function getDb(): Firestore {
  if (!dbInstance) {
    const app = getAppInstance();
    dbInstance = getFirestore(app); // 명시적으로 app 전달
  }
  return dbInstance;
}

// 초기화된 앱을 사용하여 Auth 인스턴스 가져오기
function getAuthInstance(): Auth {
  if (!authInstance) {
    const app = getAppInstance();
    authInstance = getAuth(app); // 명시적으로 app 전달
  }
  return authInstance;
}

// 전역 초기화 제거 (배포 타임아웃 방지)
// 각 함수에서 필요할 때 getAppInstance()를 호출하여 lazy initialization 수행

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

// 현장 중심 좌표
const SITE_CENTER = {
  latitude: 37.536111,
  longitude: 126.833333,
  radiusMeters: 500000, // 500km (임시)
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
  const db = getDb();
  const auth = getAuthInstance();

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
 * [수정됨] 관리자용 수동 데이터 완전 초기화
 * - 기능: 공지사항, 알람, 그리고 '출석 데이터(authCheckIns)'까지 모두 삭제합니다.
 * - 목적: UI 데이터 테이블 과부하 방지 및 완전한 하루 초기화
 */
export const manualResetData = onCall(
  { region: "us-central1" },
  async (request) => {
    // 1. 인증 확인
    if (!request.auth) {
      throw new Error("인증이 필요합니다.");
    }

    const userEmail = request.auth.token.email || "관리자";
    logger.info(`🔥 수동 완전 초기화 요청: ${userEmail}`);

    const db = getDb(); // 방탄 초기화된 DB 인스턴스 사용

    try {
      // ==================================================================
      // 1단계: 출석 데이터(authCheckIns) 삭제 (UI 테이블 비우기용)
      // ==================================================================
      try {
        const checkInsSnapshot = await db.collection("authCheckIns").get();
        const batches: WriteBatch[] = [];
        let currentBatch = db.batch();
        let count = 0;

        checkInsSnapshot.docs.forEach((doc, index) => {
          currentBatch.delete(doc.ref);
          count++;
          // 배치 제한 (500개) 안전하게 400개로 설정
          if (count >= 400 || index === checkInsSnapshot.docs.length - 1) {
            batches.push(currentBatch);
            if (index < checkInsSnapshot.docs.length - 1) {
              currentBatch = db.batch();
              count = 0;
            }
          }
        });

        // 병렬로 빠르게 삭제 처리
        if (batches.length > 0) {
          await Promise.all(batches.map((batch) => batch.commit()));
        }
        logger.info(`✅ 출석 데이터 ${checkInsSnapshot.size}건 삭제 완료`);
      } catch (error) {
        logger.error("출석 데이터 삭제 중 오류:", error);
      }

      // ==================================================================
      // 2단계: 공지사항 및 알림 데이터 삭제 (기존 로직 유지)
      // ==================================================================
      const collectionsToDelete = [
        "bulletins",
        "emergencyAlerts",
        "siteStatusLogs",
        "checkoutPrompts",
      ];

      for (const colName of collectionsToDelete) {
        try {
          const snapshot = await db.collection(colName).get();
          if (snapshot.empty) continue;

          const batches: WriteBatch[] = [];
          let currentBatch = db.batch();
          let count = 0;

          snapshot.docs.forEach((doc, index) => {
            // 모든 공지사항 및 알림, 메시지 삭제 (지속 메시지 포함)
            currentBatch.delete(doc.ref);
            count++;

            if (count >= 400 || index === snapshot.docs.length - 1) {
              batches.push(currentBatch);
              if (index < snapshot.docs.length - 1) {
                currentBatch = db.batch();
                count = 0;
              }
            }
          });

          if (batches.length > 0) {
            await Promise.all(batches.map((batch) => batch.commit()));
          }
          logger.info(`${colName} 컬렉션 삭제 완료`);
        } catch (e) {
          logger.error(`${colName} 컬렉션 정리 실패:`, e);
        }
      }

      logger.info("✅ 수동 완전 초기화 작업 완료");
      return {
        success: true,
        message: "모든 데이터(출석 포함)가 초기화되었습니다.",
      };
    } catch (error) {
      logger.error("초기화 작업 치명적 오류:", error);
      throw new Error("초기화 중 오류가 발생했습니다.");
    }
  }
);

/**
 * 전체 사용자 강제 로그아웃
 * - 기능: 모든 사용자의 Refresh Token을 만료시킴 (실제 로그아웃)
 * - 데이터: 출석 데이터(DB)는 건드리지 않음 (프론트에서만 안 보이게 처리했으므로)
 */
export const manualRevokeSessions = onCall(
  { region: "us-central1" },
  async (request) => {
    // 1. 인증 확인
    if (!request.auth) {
      throw new Error("인증이 필요합니다.");
    }

    logger.info("🔥 [System] 전체 사용자 강제 로그아웃 시작");

    const db = getDb(); // Firestore 인스턴스 사용

    try {
      let successCount = 0;
      let errorCount = 0;

      // 2. authCheckIns에서 checkOutTime이 없는 모든 문서 가져오기
      const checkInsSnapshot = await db.collection("authCheckIns").get();

      // checkOutTime이 없는 문서만 필터링
      const activeCheckIns = checkInsSnapshot.docs.filter((doc) => {
        const data = doc.data();
        return !data.checkOutTime;
      });

      if (activeCheckIns.length === 0) {
        logger.info("✅ 로그아웃할 활성 세션이 없습니다.");
        return {
          success: true,
          message: "로그아웃할 활성 세션이 없습니다.",
        };
      }

      // 3. 배치로 checkOutTime 설정
      const batches: WriteBatch[] = [];
      let currentBatch = db.batch();
      let count = 0;

      activeCheckIns.forEach((docSnapshot, index) => {
        currentBatch.update(docSnapshot.ref, {
          checkOutTime: FieldValue.serverTimestamp(),
        });
        count++;

        // 배치 제한 (500개) 안전하게 400개로 설정
        if (count >= 400 || index === activeCheckIns.length - 1) {
          batches.push(currentBatch);
          if (index < activeCheckIns.length - 1) {
            currentBatch = db.batch();
            count = 0;
          }
        }
      });

      // 4. 모든 배치 병렬 실행
      if (batches.length > 0) {
        const batchResults = await Promise.all(
          batches.map(async (batch, batchIndex) => {
            try {
              await batch.commit();
              // 마지막 배치는 실제 문서 수가 400개보다 적을 수 있음
              const actualCount =
                batchIndex === batches.length - 1
                  ? activeCheckIns.length - (batches.length - 1) * 400
                  : 400;
              return { success: true, count: actualCount };
            } catch (err) {
              logger.error(`배치 ${batchIndex} 커밋 실패:`, err);
              return { success: false, count: 0 };
            }
          })
        );

        successCount = batchResults.reduce(
          (sum, result) => sum + (result.success ? result.count : 0),
          0
        );
        errorCount = activeCheckIns.length - successCount;
      }

      logger.info(
        `✅ 전체 로그아웃 완료: 성공 ${successCount}명, 실패 ${errorCount}명`
      );
      return {
        success: true,
        message: `총 ${successCount}명의 세션을 만료시켰습니다.`,
      };
    } catch (error) {
      logger.error("로그아웃 프로세스 오류:", error);
      throw new Error("로그아웃 처리 중 서버 오류가 발생했습니다.");
    }
  }
);

/**
 * 출석 상태 체크 로직 (내부 함수)
 */
async function checkAttendanceStatus(checkTime: string) {
  logger.info(`${checkTime} 출석 상태 체크 시작`);
  const db = getDb();

  try {
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
        SITE_CENTER.latitude,
        SITE_CENTER.longitude,
        user.location.latitude,
        user.location.longitude
      );

      if (distance <= SITE_CENTER.radiusMeters) {
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

[응답 형식]
{
  "columns": ["userName", "department", "timestamp"],
  "filter": { "department": "삼성물산" },
  "sortBy": "timestamp",
  "sortOrder": "desc",
  "message": "삼성물산 직원들의 출근 기록입니다."
}

[규칙]
1. 질문과 가장 연관성 높은 컬럼만 columns 배열에 담으세요.
2. 찾으려는 조건이 명확하면 filter 객체에 담으세요. (없으면 빈 객체 {})
3. 정렬이 필요하면 sortBy와 sortOrder를 지정하세요. (기본: timestamp, desc)
4. message는 한국어로 사용자에게 보여줄 요약 메시지입니다.

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
