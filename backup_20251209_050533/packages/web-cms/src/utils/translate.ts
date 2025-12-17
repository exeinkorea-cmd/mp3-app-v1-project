import { TranslateResponse } from "../types";

// 번역 함수 호출 (onRequest로 변경했으므로 일반 HTTP 요청 사용)
export const callTestTranslate = async (data: { text: string }): Promise<TranslateResponse> => {
  const functionUrl = `https://us-central1-mp3-app-v1-3cf12.cloudfunctions.net/testTranslateV2`;

  const response = await fetch(functionUrl, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(data),
  });

  if (!response.ok) {
    const errorData = await response.json();
    throw new Error(
      errorData.message || `HTTP error! status: ${response.status}`
    );
  }

  return { data: await response.json() };
};




















