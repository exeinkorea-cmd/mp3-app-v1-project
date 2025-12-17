import { GoogleGenerativeAI } from "@google/generative-ai";
import { collection, getDocs } from "firebase/firestore";
import { db } from "../firebase";
import { AuthCheckIn } from "../types";

// Gemini API 키 (환경 변수에서 가져오기)
const getGeminiApiKey = (): string => {
  const apiKey = process.env.REACT_APP_GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error("REACT_APP_GEMINI_API_KEY가 설정되지 않았습니다.");
  }
  return apiKey;
};

// 현장 중심 좌표
const SITE_CENTER = {
  latitude: 37.536111,
  longitude: 126.833333,
  radiusMeters: 500000,
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

// authCheckIns 데이터 요약 및 JSON 변환
export const getAttendanceSummary = async (): Promise<any[]> => {
  try {
    const checkInsSnapshot = await getDocs(collection(db, "authCheckIns"));
    const summary: any[] = [];

    checkInsSnapshot.forEach((doc) => {
      const data = doc.data() as AuthCheckIn;

      // 현장 내부 여부 계산
      let isOnSite = false;
      if (data.location) {
        const distance = calculateDistance(
          SITE_CENTER.latitude,
          SITE_CENTER.longitude,
          data.location.latitude,
          data.location.longitude
        );
        isOnSite = distance <= SITE_CENTER.radiusMeters;
      }

      // 핵심 필드만 추출
      const summaryItem: any = {
        userName: data.userName || "알 수 없음",
        department: data.department || "알 수 없음",
        checkInTime: data.timestamp
          ? new Date(data.timestamp.toMillis()).toLocaleString("ko-KR")
          : null,
        checkOutTime: data.checkOutTime
          ? new Date(data.checkOutTime.toMillis()).toLocaleString("ko-KR")
          : null,
        isCheckedOut: !!data.checkOutTime,
        isOnSite: isOnSite,
      };

      summary.push(summaryItem);
    });

    return summary;
  } catch (error) {
    console.error("출석 데이터 요약 오류:", error);
    throw error;
  }
};

// Gemini API 호출
export const askGemini = async (question: string): Promise<string> => {
  try {
    const apiKey = getGeminiApiKey();
    const genAI = new GoogleGenerativeAI(apiKey);
    const model = genAI.getGenerativeModel({ model: "gemini-2.0-flash-001" });

    // 출석 데이터 요약 가져오기
    const attendanceData = await getAttendanceSummary();

    // System Prompt
    const systemPrompt = `너는 건설 현장 관리 AI야. 아래 제공된 JSON 데이터를 기반으로 사용자의 질문에 한국어로 명확하게 답변해. 데이터에 없는 내용은 모른다고 해.

출석 데이터:
${JSON.stringify(attendanceData, null, 2)}

사용자 질문: ${question}

위 데이터를 기반으로 질문에 답변해줘.`;

    const result = await model.generateContent(systemPrompt);
    const response = await result.response;
    const text = response.text();

    return text;
  } catch (error) {
    console.error("Gemini API 호출 오류:", error);
    const errorMessage =
      error instanceof Error ? error.message : "알 수 없는 오류";
    throw new Error(`AI 응답 생성 실패: ${errorMessage}`);
  }
};

/**
 * 출석현황 챗봇용 Gemini API 호출 (JSON 응답)
 * 데이터 분석 챗봇과 동일한 방식이지만 JSON 형식으로 응답받음
 */
export const askGeminiForAttendance = async (
  question: string
): Promise<{
  columns: string[];
  filter: Record<string, string>;
  sortBy?: string;
  sortOrder?: "asc" | "desc";
  message: string;
}> => {
  try {
    const apiKey = getGeminiApiKey();
    const genAI = new GoogleGenerativeAI(apiKey);
    const model = genAI.getGenerativeModel({ model: "gemini-2.0-flash-001" });

    // 출석 데이터 요약 가져오기
    const attendanceData = await getAttendanceSummary();

    // System Prompt (JSON 응답 요청)
    const systemPrompt = `당신은 건설 현장 출석 데이터 관리 AI입니다. 
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

출석 데이터:
${JSON.stringify(attendanceData, null, 2)}

사용자 질문: ${question}

위 규칙에 따라 JSON만 반환하세요.`;

    const result = await model.generateContent(systemPrompt);
    const response = await result.response;
    const responseText = response.text();

    console.log("🤖 [AI 원본 응답]:", responseText);

    // 마크다운 기호 제거
    const cleanedText = responseText.replace(/```json|```/g, "").trim();

    // JSON 파싱
    const parsedResponse = JSON.parse(cleanedText);
    return parsedResponse;
  } catch (error) {
    console.error("Gemini API 호출 오류:", error);
    const errorMessage =
      error instanceof Error ? error.message : "알 수 없는 오류";
    throw new Error(`AI 응답 생성 실패: ${errorMessage}`);
  }
};
