// F:\mp3-app\mp3-app-v1-project\packages\functions\src\index.ts

import { onRequest } from "firebase-functions/v2/https";
import { onSchedule } from "firebase-functions/v2/scheduler";
import { onCall } from "firebase-functions/v2/https";
import * as logger from "firebase-functions/logger";
// [최적화] Translate 클래스는 lazy loading으로 변경하여 초기 로딩 속도 향상
// import { Translate } from "@google-cloud/translate/build/src/v2";
import { initializeApp, getApps } from "firebase-admin/app";
import { getFirestore, FieldValue, WriteBatch } from "firebase-admin/firestore";
import { getAuth } from "firebase-admin/auth";
import cors from "cors";
import { GoogleGenerativeAI } from "@google/generative-ai";

// Firebase Admin 초기화 (배포 타임아웃 방지를 위해 최상위에서 한 번만 초기화)
if (getApps().length === 0) {
  initializeApp();
}
const db = getFirestore();
const auth = getAuth();

// CORS 설정 (lazy initialization)
let corsHandlerInstance: ReturnType<typeof cors> | null = null;
function getCorsHandler() {
  if (!corsHandlerInstance) {
    corsHandlerInstance = cors({
      origin: true, // 모든 origin 허용 (프로덕션에서는 특정 origin만 허용하도록 변경)
      credentials: true,
    });
  }
  return corsHandlerInstance;
}

// [신규!] 번역할 목표 언어 리스트
const TARGET_LANGUAGES = ["en", "zh", "ru", "vi"];

// 현장 중심 좌표 (LocationBasedLogin.tsx와 동일)
const SITE_CENTER = {
  latitude: 37.536111,
  longitude: 126.833333,
  radiusMeters: 500000, // 500km (임시)
};

// 두 좌표 간 거리 계산 (Haversine 공식, 미터 단위)
const calculateDistance = (
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number
): number => {
  const R = 6371000; // 지구 반지름 (미터)
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

/**
 * [업그레이드!] 텍스트를 4개 국어로 '동시' 번역합니다.
 * [최적화] Translate 클래스를 lazy loading으로 변경하여 초기 로딩 속도 향상
 */
export const testTranslateV2 = onRequest(
  {
    region: "us-central1",
  },
  async (request, response) => {
    // CORS 처리
    getCorsHandler()(request, response, async () => {
      try {
        // POST 요청의 body에서 text 추출
        const { text } = request.body;

        if (!text) {
          logger.warn("텍스트가 없습니다.");
          response.status(400).json({
            error: "invalid-argument",
            message: "텍스트를 입력해주세요.",
          });
          return;
        }

        logger.info(`다국어 번역 요청 수신: ${text}`);

        // 번역 엔진 초기화 (동적 import로 변경하여 배포 타임아웃 방지)
        const { v2 } = await import("@google-cloud/translate");
        const translate = new v2.Translate();

        try {
          const promises = TARGET_LANGUAGES.map((lang) => {
            return translate.translate(text, lang);
          });

          const results = await Promise.all(promises);

          const translations: Record<string, string> = {};

          results.forEach((result, index) => {
            const lang = TARGET_LANGUAGES[index];
            const [translation] = result;
            translations[lang] = translation;
          });

          logger.info("다국어 번역 성공:", translations);

          response.status(200).json({ translatedObject: translations });
        } catch (error) {
          const errorMessage =
            error instanceof Error ? error.message : String(error);
          logger.error("번역 실패:", errorMessage, error);
          response.status(500).json({
            error: "internal",
            message: `API 호출에 실패했습니다: ${errorMessage}`,
          });
        }
      } catch (error) {
        const errorMessage =
          error instanceof Error ? error.message : String(error);
        logger.error("요청 처리 실패:", errorMessage, error);
        response.status(500).json({
          error: "internal",
          message: `요청 처리에 실패했습니다: ${errorMessage}`,
        });
      }
    });
  }
);

// 공통 초기화 로직 함수
async function performDailyReset(): Promise<void> {
  logger.info("일일 초기화 작업 시작");

  try {
    // 1. authCheckIns 컬렉션의 모든 문서 삭제 및 세션 무효화
    try {
      // authCheckIns 컬렉션에서 모든 문서 가져오기
      const checkInsSnapshot = await db.collection("authCheckIns").get();

      // Batch를 사용하여 authCheckIns 문서 삭제 (최대 500개씩)
      const checkInsBatches: WriteBatch[] = [];
      let currentBatch = db.batch();
      let batchCount = 0;

      checkInsSnapshot.docs.forEach((doc, index) => {
        currentBatch.delete(doc.ref);
        batchCount++;

        // 500개마다 또는 마지막 문서일 때 batch 실행
        if (batchCount >= 500 || index === checkInsSnapshot.docs.length - 1) {
          checkInsBatches.push(currentBatch);
          if (index < checkInsSnapshot.docs.length - 1) {
            currentBatch = db.batch();
            batchCount = 0;
          }
        }
      });

      // 모든 batch 실행
      if (checkInsBatches.length > 0) {
        await Promise.all(checkInsBatches.map((batch) => batch.commit()));
      }
      logger.info(
        `authCheckIns 컬렉션 ${checkInsSnapshot.docs.length}개 문서 삭제 완료`
      );

      // 모든 Firebase Auth 사용자의 세션 무효화 (익명 사용자 포함)
      let totalRevoked = 0;
      let nextPageToken: string | undefined;

      do {
        const listUsersResult = await auth.listUsers(1000, nextPageToken);

        // 각 사용자의 세션 토큰 무효화
        const revokePromises = listUsersResult.users.map(async (userRecord) => {
          try {
            await auth.revokeRefreshTokens(userRecord.uid);
            return 1;
          } catch (error) {
            logger.error(`사용자 ${userRecord.uid} 세션 무효화 실패:`, error);
            return 0;
          }
        });

        const results = await Promise.all(revokePromises);
        totalRevoked += results.reduce<number>((sum, count) => sum + count, 0);

        nextPageToken = listUsersResult.pageToken;
      } while (nextPageToken);

      logger.info(`총 ${totalRevoked}명의 사용자 세션 무효화 완료 (익명 사용자 포함)`);
    } catch (error) {
      logger.error("authCheckIns 삭제 및 세션 무효화 오류:", error);
    }

    // 2. 공지사항 삭제 (지속 메시지 제외) - Batch 사용
    try {
      const bulletinsSnapshot = await db.collection("bulletins").get();
      const now = new Date();
      const deleteBatches: WriteBatch[] = [];
      let currentBatch = db.batch();
      let batchCount = 0;
      let persistentCount = 0;
      let deletedCount = 0;

      bulletinsSnapshot.docs.forEach((doc, index) => {
        const data = doc.data();
        const isPersistent = data.isPersistent === true;
        const expiryDate = data.expiryDate;

        // 지속 메시지이고 만료일이 아직 지나지 않은 경우 삭제하지 않음
        if (isPersistent && expiryDate) {
          const expiryDateObj = expiryDate.toDate();
          if (expiryDateObj > now) {
            persistentCount++;
            logger.info(
              `지속 메시지 보존: ${
                doc.id
              } (만료일: ${expiryDateObj.toISOString()})`
            );
            return; // 삭제하지 않음
          }
        }

        // 삭제 대상
        currentBatch.delete(doc.ref);
        deletedCount++;
        batchCount++;

        // 500개마다 또는 마지막 문서일 때 batch 실행
        if (batchCount >= 500 || index === bulletinsSnapshot.docs.length - 1) {
          deleteBatches.push(currentBatch);
          if (index < bulletinsSnapshot.docs.length - 1) {
            currentBatch = db.batch();
            batchCount = 0;
          }
        }
      });

      // 모든 batch 실행
      if (deleteBatches.length > 0) {
        await Promise.all(deleteBatches.map((batch) => batch.commit()));
      }
      logger.info(
        `총 ${deletedCount}개의 공지사항 삭제 완료, ${persistentCount}개의 지속 메시지 보존`
      );
    } catch (error) {
      logger.error("공지사항 삭제 오류:", error);
    }

    // 3. 모든 화재접수 내용 삭제 - Batch 사용
    try {
      const alertsSnapshot = await db.collection("emergencyAlerts").get();
      const deleteBatches: WriteBatch[] = [];
      let currentBatch = db.batch();
      let batchCount = 0;

      alertsSnapshot.docs.forEach((doc, index) => {
        currentBatch.delete(doc.ref);
        batchCount++;

        // 500개마다 또는 마지막 문서일 때 batch 실행
        if (batchCount >= 500 || index === alertsSnapshot.docs.length - 1) {
          deleteBatches.push(currentBatch);
          if (index < alertsSnapshot.docs.length - 1) {
            currentBatch = db.batch();
            batchCount = 0;
          }
        }
      });

      // 모든 batch 실행
      if (deleteBatches.length > 0) {
        await Promise.all(deleteBatches.map((batch) => batch.commit()));
      }
      logger.info(
        `총 ${alertsSnapshot.docs.length}개의 화재접수 내용 삭제 완료`
      );
    } catch (error) {
      logger.error("화재접수 내용 삭제 오류:", error);
    }

    logger.info("일일 초기화 작업 완료");
  } catch (error) {
    logger.error("일일 초기화 작업 중 오류 발생:", error);
    throw error;
  }
}

/**
 * 매일 오후 8시 (한국시간)에 실행되는 스케줄 함수
 * - 모든 사용자 자동 로그아웃 (세션 무효화)
 * - 모든 공지사항 초기화
 * - 모든 화재접수 내용 초기화
 *
 * 참고: 퇴근 체크 로직(16:30 ~ 17:30)이 정상 작동하도록 오후 8시에 실행
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
 * 수동 초기화 Callable Function (관리자 전용)
 */
export const manualResetData = onCall(
  {
    region: "us-central1",
  },
  async (request) => {
    // 인증 확인
    if (!request.auth) {
      throw new Error("인증이 필요합니다.");
    }

    // TODO: 추후 실제 운영 시 admin claim 체크 복구 필요
    // MVP 테스트 단계: 로그인한 사용자(Web CMS 접속자)는 모두 관리자로 간주

    const userEmail = request.auth.token.email || "알 수 없음";
    logger.info(`수동 초기화 요청: ${userEmail}`);

    try {
      await performDailyReset();
      logger.info(`수동 초기화 완료: ${userEmail}`);
      return { success: true, message: "초기화가 완료되었습니다." };
    } catch (error) {
      logger.error(`수동 초기화 실패: ${userEmail}`, error);
      throw new Error("초기화 중 오류가 발생했습니다.");
    }
  }
);

/**
 * 전체 사용자 강제 로그아웃 Callable Function (관리자 전용)
 * 데이터는 삭제하지 않고 세션만 만료시킵니다.
 */
export const manualRevokeSessions = onCall(
  {
    region: "us-central1",
  },
  async (request) => {
    // 인증 확인
    if (!request.auth) {
      throw new Error("인증이 필요합니다.");
    }

    // TODO: 추후 실제 운영 시 admin claim 체크 복구 필요
    // MVP 테스트 단계: 로그인한 사용자(Web CMS 접속자)는 모두 관리자로 간주

    const userEmail = request.auth.token.email || "알 수 없음";
    logger.info(`전체 사용자 강제 로그아웃 요청: ${userEmail}`);

    try {
      let totalRevoked = 0;
      let nextPageToken: string | undefined;

      // 배치 처리: 한 번에 최대 1000명씩 처리
      do {
        const listUsersResult = await auth.listUsers(
          1000,
          nextPageToken
        );

        // 각 사용자의 세션 토큰 무효화
        const revokePromises = listUsersResult.users.map(async (userRecord) => {
          try {
            await auth.revokeRefreshTokens(userRecord.uid);
            return 1;
          } catch (error) {
            logger.error(`사용자 ${userRecord.uid} 세션 무효화 실패:`, error);
            return 0;
          }
        });

        const results = await Promise.all(revokePromises);
        totalRevoked += results.reduce<number>((sum, count) => sum + count, 0);

        nextPageToken = listUsersResult.pageToken;
      } while (nextPageToken);

      logger.info(
        `전체 사용자 강제 로그아웃 완료: ${totalRevoked}명 (요청자: ${userEmail})`
      );
      return {
        success: true,
        message: `${totalRevoked}명의 사용자 세션이 만료되었습니다.`,
      };
    } catch (error) {
      logger.error(`전체 사용자 강제 로그아웃 실패: ${userEmail}`, error);
      throw new Error("세션 만료 중 오류가 발생했습니다.");
    }
  }
);

// 공통 체크 로직
async function checkAttendanceStatus(checkTime: string) {
  logger.info(`${checkTime} 출석 상태 체크 시작`);

  try {
    // 1. 퇴근하지 않은 사용자 목록 가져오기
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

    // 2. 각 사용자의 위치와 현장 거리 계산
    for (const user of activeUsers) {
      if (!user.location) continue;

      const distance = calculateDistance(
        SITE_CENTER.latitude,
        SITE_CENTER.longitude,
        user.location.latitude,
        user.location.longitude
      );

      // Case A: 현장 내부 (반경 내)
      if (distance <= SITE_CENTER.radiusMeters) {
        siteInsideUsers.push(user.userName);
        logger.info(
          `${user.userName} - 현장 내부 (거리: ${Math.round(distance)}m)`
        );
      } else {
        // Case B: 현장 외부
        const lastPrompt = user.lastCheckoutPrompt;
        const now = new Date();

        // 이전 회차에 이미 알림을 보냈는지 확인
        if (lastPrompt && lastPrompt.timestamp) {
          const promptTime = lastPrompt.timestamp.toDate();
          const timeDiff = now.getTime() - promptTime.getTime();
          const minutesDiff = timeDiff / (1000 * 60);

          // 30분 이상 지났으면 자동 퇴근 처리
          if (minutesDiff >= 30) {
            logger.info(
              `${user.userName} - 30분 경과, 자동 퇴근 처리 (거리: ${Math.round(
                distance
              )}m)`
            );
            autoCheckoutUsers.push(user.userId);

            // checkOutTime 업데이트
            await db.collection("authCheckIns").doc(user.docId).update({
              checkOutTime: FieldValue.serverTimestamp(),
              autoCheckout: true,
              autoCheckoutReason: "현장 외부 30분 경과",
              autoCheckoutAt: FieldValue.serverTimestamp(),
            });
          } else {
            // 아직 30분 안 지났으면 알림만 다시 보냄
            siteOutsideUsers.push({
              docId: user.docId,
              userId: user.userId,
              userName: user.userName,
            });
          }
        } else {
          // 처음 현장 외부 감지 - 알림 보내기
          siteOutsideUsers.push({
            docId: user.docId,
            userId: user.userId,
            userName: user.userName,
          });
        }
      }
    }

    // 3. Case A: 현장 내부 사용자 - siteStatusLogs에 기록
    if (siteInsideUsers.length > 0) {
      await db
        .collection("siteStatusLogs")
        .add({
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

    // 4. Case B: 현장 외부 사용자 - 퇴근 확인 알림 보내기
    for (const user of siteOutsideUsers) {
      // Firestore에 알림 문서 생성 (모바일 앱이 구독)
      await db.collection("checkoutPrompts").add({
        userId: user.userId,
        userName: user.userName,
        timestamp: FieldValue.serverTimestamp(),
        message: "퇴근 하시겠습니까?",
        status: "pending",
        checkTime: checkTime,
      });

      // authCheckIns에 알림 보낸 기록 업데이트
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
 * 사용자의 자연어 질문을 필터 조건(JSON)으로 변환
 */
export const analyzeAttendanceQuery = onCall(
  {
    region: "us-central1",
  },
  async (request) => {
    // 1. 인증 체크 (테스트 중엔 잠시 주석 처리)
    if (!request.auth) {
      // console.log("⚠️ 인증되지 않은 사용자 요청");
      // throw new Error("인증이 필요합니다.");
    }

    const userQuery = request.data.text;
    logger.info(`📡 [AI 요청] 사용자 질문: "${userQuery}"`);

    if (!userQuery) {
      throw new Error("질문 텍스트가 필요합니다.");
    }

    try {
      // 2. API 키 확인 (디버깅용, 키 앞자리만 출력)
      const apiKey = process.env.GEMINI_API_KEY;
      if (!apiKey) {
        logger.error("❌ GEMINI_API_KEY가 설정되지 않았습니다!");
        throw new Error("Server API Key missing");
      }
      logger.info(`🔑 API Key 상태: ${apiKey.substring(0, 5)}...`);

      // Gemini 2.0 Flash 모델 초기화
      const genAI = new GoogleGenerativeAI(apiKey);
      const model = genAI.getGenerativeModel({
        model: "gemini-2.0-flash-exp",
        generationConfig: {
          responseMimeType: "application/json",
        },
      });

      // System Prompt
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

      logger.info("🤖 [AI 원본 응답]:", responseText); // 로그 확인용

      // ✅ 핵심 수정: 마크다운 기호(```json 등) 제거
      const cleanedText = responseText.replace(/```json|```/g, "").trim();

      // JSON 파싱 후 반환
      const parsedResponse = JSON.parse(cleanedText);
      return parsedResponse;
    } catch (error) {
      logger.error("❌ AI 분석/파싱 실패 상세:", error); // 여기에 진짜 원인이 찍힘
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      throw new Error(`분석 중 오류가 발생했습니다: ${errorMessage}`);
    }
  }
);
