// F:\mp3-app\mp3-app-v1-project\packages\functions\src\index.ts

import { onCall, HttpsError } from "firebase-functions/v2/https";
import * as logger from "firebase-functions/logger";
import { Translate } from "@google-cloud/translate/build/src/v2";

const translate = new Translate();

// [신규!] 번역할 목표 언어 리스트
const TARGET_LANGUAGES = ["en", "zh", "ru", "vi"];

/**
 * [업그레이드!] 텍스트를 4개 국어로 '동시' 번역합니다.
 */
export const testTranslate = onCall(async (request) => {
  const text = request.data.text;
  if (!text) {
    logger.warn("텍스트가 없습니다.");
    throw new HttpsError("invalid-argument", "텍스트를 입력해주세요.");
  }

  logger.info(`다국어 번역 요청 수신: ${text}`);

  try {
    // 1. [핵심!] 4개 국어 번역을 '동시에' 병렬로 요청합니다.
    const promises = TARGET_LANGUAGES.map((lang) => {
      return translate.translate(text, lang);
    });

    // 2. 모든 번역(Promise)이 끝날 때까지 기다립니다.
    const results = await Promise.all(promises);

    // 3. [핵심!] 결과를 '객체(Object)'로 만듭니다. (예: {en: "Hello", zh: "你好", ...})
    // (Cursor의 조언대로 '명시적인 타입'을 부여합니다)
    const translations: Record<string, string> = {};

    results.forEach((result, index) => {
      const lang = TARGET_LANGUAGES[index];
      const [translation] = result;
      translations[lang] = translation;
    });

    logger.info("다국어 번역 성공:", translations);

    // 4. '객체'를 반환합니다.
    return { translatedObject: translations };
  } catch (error) {
    logger.error("번역 실패:", error);
    throw new HttpsError("internal", "API 호출에 실패했습니다.");
  }
});
