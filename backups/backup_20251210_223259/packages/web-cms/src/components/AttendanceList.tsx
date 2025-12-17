import React, { useState, useEffect, useMemo } from "react";
import {
  collection,
  query,
  onSnapshot,
  orderBy,
  Timestamp,
  addDoc,
} from "firebase/firestore";
import { db } from "../firebase";
import { askGeminiForAttendance } from "../utils/gemini";
import { AuthCheckIn } from "../types";
import { Download, Bot } from "lucide-react";
import { DesignTokens } from "../constants/designTokens";

// 표시할 컬럼 정의 (전체 목록)
const ALL_COLUMNS: Record<
  string,
  { label: string; key: keyof AuthCheckIn }
> = {
  userName: { label: "이름", key: "userName" },
  phoneNumber: { label: "전화번호", key: "phoneNumber" },
  department: { label: "소속", key: "department" },
  timestamp: { label: "출근시간", key: "timestamp" },
  checkOutTime: { label: "퇴근시간", key: "checkOutTime" },
  highRiskWork: { label: "고위험 작업", key: "highRiskWork" },
  noticeConfirmed: { label: "공지 확인", key: "noticeConfirmed" },
};

const AttendanceList: React.FC = () => {
  const [checkIns, setCheckIns] = useState<AuthCheckIn[]>([]);
  
  // 챗봇 관련 상태
  const [chatInput, setChatInput] = useState(""); // 채팅 입력값
  const [aiMessage, setAiMessage] = useState(""); // AI 응답 메시지
  const [activeColumns, setActiveColumns] = useState<string[]>(
    Object.keys(ALL_COLUMNS)
  ); // 현재 보여줄 컬럼들
  const [filterConditions, setFilterConditions] = useState<
    Record<string, string>
  >({}); // 필터 조건
  const [sortBy, setSortBy] = useState<string>("timestamp"); // 정렬 필드
  const [sortOrder, setSortOrder] = useState<"asc" | "desc">("desc"); // 정렬 순서
  const [loading, setLoading] = useState(false);

  // authCheckIns 컬렉션에서 실시간 데이터 수신
  useEffect(() => {
    const q = query(
      collection(db, "authCheckIns"),
      orderBy("timestamp", "desc")
    );

    const unsubscribe = onSnapshot(
      q,
      (querySnapshot) => {
        const docs: AuthCheckIn[] = [];
        querySnapshot.forEach((doc) => {
          docs.push({ id: doc.id, ...doc.data() } as AuthCheckIn);
        });
        setCheckIns(docs);
        console.log("실시간 출역 현황 수신:", docs.length, "개");
      },
      (error) => {
        console.error("출역 데이터 수신 오류:", error);
      }
    );

    return () => unsubscribe();
  }, []);

  // 시간 포맷 헬퍼 함수
  const formatTime = (timestamp: Timestamp | Date | undefined): string => {
    if (!timestamp) return "-";
    try {
      if (timestamp instanceof Timestamp) {
        const date = timestamp.toDate();
        return date.toLocaleTimeString("ko-KR", {
          hour: "2-digit",
          minute: "2-digit",
        });
      } else if (timestamp instanceof Date) {
        return timestamp.toLocaleTimeString("ko-KR", {
          hour: "2-digit",
          minute: "2-digit",
        });
      }
      return "-";
    } catch (e) {
      return "-";
    }
  };

  // 챗봇에게 물어보기
  const handleAskAI = async () => {
    if (!chatInput.trim()) return;

    setLoading(true);
    try {
      // 프론트엔드에서 직접 Gemini API 호출 (데이터 분석 챗봇과 동일한 방식)
      const result = await askGeminiForAttendance(chatInput.trim());
      const { columns, filter, sortBy: aiSortBy, sortOrder: aiSortOrder, message } = result;

      // 결과 적용
      if (columns && columns.length > 0) {
        setActiveColumns(columns);
      } else {
        setActiveColumns(Object.keys(ALL_COLUMNS));
      }

      setFilterConditions(filter || {});
      if (aiSortBy) setSortBy(aiSortBy);
      if (aiSortOrder) setSortOrder(aiSortOrder);
      setAiMessage(message || "");

      // 입력창 초기화
      setChatInput("");
    } catch (error) {
      console.error("AI 분석 실패:", error);
      setAiMessage("AI 분석에 실패했습니다. 다시 시도해주세요.");
    } finally {
      setLoading(false);
    }
  };

  // 필터링 및 정렬된 데이터 계산
  const filteredAndSortedData = useMemo(() => {
    let filtered = checkIns.filter((item) => {
      // filterConditions에 있는 모든 조건(AND)을 만족해야 함
      return Object.entries(filterConditions).every(([key, value]) => {
        const itemValue = item[key as keyof AuthCheckIn]?.toString() || "";
        // 부분 일치 검색 (예: "삼성" -> "삼성물산" 매칭)
        return itemValue.toLowerCase().includes(value.toLowerCase());
      });
    });

    // 정렬
    if (sortBy) {
      filtered.sort((a, b) => {
        const aValue = a[sortBy as keyof AuthCheckIn];
        const bValue = b[sortBy as keyof AuthCheckIn];

        // Timestamp 타입 처리
        if (aValue instanceof Timestamp && bValue instanceof Timestamp) {
          const aTime = aValue.toMillis();
          const bTime = bValue.toMillis();
          return sortOrder === "asc" ? aTime - bTime : bTime - aTime;
        }

        // 일반 값 비교
        const aStr = aValue?.toString() || "";
        const bStr = bValue?.toString() || "";

        if (sortOrder === "asc") {
          return aStr.localeCompare(bStr);
        } else {
          return bStr.localeCompare(aStr);
        }
      });
    }

    return filtered;
  }, [checkIns, filterConditions, sortBy, sortOrder]);

  // 컬럼 헤더 클릭 시 정렬
  const handleSort = (columnKey: string) => {
    if (sortBy === columnKey) {
      setSortOrder(sortOrder === "asc" ? "desc" : "asc");
    } else {
      setSortBy(columnKey);
      setSortOrder("desc");
    }
  };

  // 🛠️ 테스트용 더미 데이터 생성 함수
  const handleGenerateDummy = async () => {
    if (!window.confirm("테스트 데이터 30개를 생성하시겠습니까?")) return;

    setLoading(true);
    const names = [
      "김철수",
      "이영희",
      "박민수",
      "정수진",
      "최강타",
      "조미미",
      "강백호",
      "서태웅",
      "송태섭",
      "정대만",
    ];

    const companies = ["삼성물산", "현대건설", "GS건설", "대우건설", "DL이앤씨"];

    const teams = ["1팀", "2팀", "안전팀", "전기팀", "설비팀"];

    try {
      // 30개 데이터 생성 반복문
      const promises = Array.from({ length: 30 }).map(async (_, index) => {
        const randomName = names[Math.floor(Math.random() * names.length)];
        const randomCompany =
          companies[Math.floor(Math.random() * companies.length)];
        const randomTeam = teams[Math.floor(Math.random() * teams.length)];

        // 시간 랜덤 설정 (오전 6시 ~ 9시 사이)
        const hour = 6 + Math.floor(Math.random() * 4); // 6, 7, 8, 9
        const minute = Math.floor(Math.random() * 60);

        // 오늘 날짜의 랜덤 시간
        const date = new Date();
        date.setHours(hour, minute, 0);
        // 지각 여부 (9시 이후면 지각)
        const status = hour >= 9 && minute > 0 ? "지각" : "정상";

        // Firestore에 저장 (authCheckIns 컬렉션)
        // 챗봇 테스트를 위해 companyName, teamName 필드도 명시적으로 넣어주면 좋습니다.
        return addDoc(collection(db, "authCheckIns"), {
          userId: `test_user_${index}`,
          userName: randomName,
          phoneNumber: `010-${Math.floor(1000 + Math.random() * 9000)}-${Math.floor(
            1000 + Math.random() * 9000
          )}`,
          companyName: randomCompany,
          teamName: randomTeam,
          department: `${randomCompany} - ${randomTeam}`, // 기존 로직 호환용
          timestamp: Timestamp.fromDate(date),
          location: {
            latitude: 37.5 + Math.random() * 0.1,
            longitude: 127.0 + Math.random() * 0.1,
          },
          status: status, // 챗봇 필터링용
        });
      });

      await Promise.all(promises);
      alert("✅ 30명의 출석 데이터가 생성되었습니다!");
    } catch (error) {
      console.error("데이터 생성 실패:", error);
      alert("생성 중 오류가 발생했습니다.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      style={{
        backgroundColor: DesignTokens.colors.background.default,
        padding: "24px",
        borderRadius: "10px",
        border: `1px solid ${DesignTokens.colors.border.default}`,
        boxShadow: "0 1px 2px 0 rgba(0, 0, 0, 0.05)",
      }}
    >
      {/* 인사말 */}
      <div
        style={{
          marginBottom: DesignTokens.spacing.md,
          padding: DesignTokens.spacing.md,
          backgroundColor: DesignTokens.colors.background.paper,
          borderRadius: DesignTokens.borderRadius.md,
          border: `1px solid ${DesignTokens.colors.border.default}`,
          ...DesignTokens.typography.body,
          color: DesignTokens.colors.text.primary,
          display: "flex",
          alignItems: "center",
          gap: DesignTokens.spacing.sm,
        }}
      >
        <Bot size={18} style={{ color: DesignTokens.colors.primary.main }} />
        <span>안녕하세요! 안전팀 오아이 매니저입니다. 무엇을 도와드릴까요?</span>
      </div>

      {/* 챗봇 입력창 */}
      <div
        style={{
          marginBottom: DesignTokens.spacing.md,
          padding: DesignTokens.spacing.md,
          backgroundColor: DesignTokens.colors.background.paper,
          borderRadius: DesignTokens.borderRadius.md,
          border: `1px solid ${DesignTokens.colors.border.default}`,
          display: "flex",
          gap: DesignTokens.spacing.sm,
          alignItems: "center",
        }}
      >
        <input
          value={chatInput}
          onChange={(e) => setChatInput(e.target.value)}
          placeholder="예: 삼성물산 김반장님 출근했어?"
          onKeyPress={(e) => {
            if (e.key === "Enter" && !loading) {
              handleAskAI();
            }
          }}
          disabled={loading}
          style={{
            flex: 1,
            padding: DesignTokens.spacing.sm,
            ...DesignTokens.typography.body,
            border: `1px solid ${DesignTokens.colors.border.dark}`,
            borderRadius: DesignTokens.borderRadius.md,
            backgroundColor: DesignTokens.colors.background.default,
            opacity: loading ? 0.5 : 1,
          }}
        />
      </div>

      {/* AI 메시지 - 주석 처리 */}
      {/* {aiMessage && (
        <div
          style={{
            marginBottom: DesignTokens.spacing.md,
            padding: DesignTokens.spacing.md,
            backgroundColor: DesignTokens.colors.primary.light || "#E3F2FD",
            color: DesignTokens.colors.primary.dark || "#1565C0",
            borderRadius: DesignTokens.borderRadius.md,
            border: `1px solid ${DesignTokens.colors.primary.main}`,
            ...DesignTokens.typography.bodySmall,
            display: "flex",
            alignItems: "center",
            gap: DesignTokens.spacing.sm,
          }}
        >
          <Bot size={18} />
          <span>{aiMessage}</span>
        </div>
      )} */}

      {/* 헤더 영역 */}
      <div
        className="flex items-center justify-between"
        style={{ marginBottom: DesignTokens.spacing.md }}
      >
        <h2
          style={{
            ...DesignTokens.typography.h4,
            lineHeight: 0,
            color: DesignTokens.colors.text.primary,
          }}
        >
          AI 분석 결과입니다.
        </h2>
        <div
          className="flex items-center"
          style={{ gap: DesignTokens.spacing.sm }}
        >
          <button
            className="transition-colors rounded"
            style={{
              padding: DesignTokens.spacing.sm,
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.backgroundColor =
                DesignTokens.colors.background.secondary;
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.backgroundColor = "transparent";
            }}
            title="다운로드"
          >
            <Download
              className="w-4 h-4"
              style={{ color: DesignTokens.colors.text.secondary }}
            />
          </button>
          {/* 필터 버튼 삭제 */}
          {/* 새로고침 버튼 삭제 */}
          {/* 테스트 데이터 생성 버튼 - 주석 처리 */}
          {/* <button
            onClick={handleGenerateDummy}
            disabled={loading}
            style={{
              padding: `${DesignTokens.spacing.sm} ${DesignTokens.spacing.md}`,
              backgroundColor: "#10b981",
              color: DesignTokens.colors.text.inverse,
              border: "none",
              borderRadius: DesignTokens.borderRadius.md,
              ...DesignTokens.typography.bodySmall,
              fontWeight: 500,
              cursor: loading ? "not-allowed" : "pointer",
              opacity: loading ? 0.5 : 1,
            }}
            onMouseEnter={(e) => {
              if (!loading) {
                e.currentTarget.style.backgroundColor = "#059669";
              }
            }}
            onMouseLeave={(e) => {
              if (!loading) {
                e.currentTarget.style.backgroundColor = "#10b981";
              }
            }}
            title="테스트 데이터 생성"
          >
            🧪 테스트 데이터 생성
          </button> */}
        </div>
      </div>

      {/* 테이블 */}
      <div
        className="overflow-hidden"
        style={{
          border: `1px solid ${DesignTokens.colors.border.default}`,
          borderRadius: DesignTokens.borderRadius.lg,
        }}
      >
        <table className="w-full border-collapse">
          <thead
            style={{
              backgroundColor: DesignTokens.colors.background.paper,
              borderBottom: `1px solid ${DesignTokens.colors.border.default}`,
            }}
          >
            <tr>
              {activeColumns.map((key) => {
                const column = ALL_COLUMNS[key];
                if (!column) return null;

                const isSorted = sortBy === key;
                return (
                  <th
                    key={key}
                    className="text-left uppercase tracking-wider border-r"
                    onClick={() => handleSort(key)}
                    style={{
                      paddingLeft: DesignTokens.spacing.md,
                      paddingRight: DesignTokens.spacing.md,
                      paddingTop: DesignTokens.spacing.md,
                      paddingBottom: DesignTokens.spacing.md,
                      ...DesignTokens.typography.caption,
                      lineHeight: 0,
                      fontWeight: 500,
                      color: DesignTokens.colors.text.secondary,
                      borderRightColor: DesignTokens.colors.border.default,
                      cursor: "pointer",
                      userSelect: "none",
                      backgroundColor: isSorted
                        ? DesignTokens.colors.background.secondary
                        : "transparent",
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.backgroundColor =
                        DesignTokens.colors.background.secondary;
                    }}
                    onMouseLeave={(e) => {
                      if (!isSorted) {
                        e.currentTarget.style.backgroundColor = "transparent";
                      }
                    }}
                  >
                    <div
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: DesignTokens.spacing.xs,
                      }}
                    >
                      {column.label}
                      {isSorted && (
                        <span style={{ fontSize: "10px" }}>
                          {sortOrder === "asc" ? "↑" : "↓"}
                        </span>
                      )}
                    </div>
                  </th>
                );
              })}
            </tr>
          </thead>
          <tbody
            style={{
              backgroundColor: DesignTokens.colors.background.default,
            }}
          >
            {filteredAndSortedData.length === 0 ? (
              <tr>
                <td
                  colSpan={activeColumns.length}
                  className="text-center"
                  style={{
                    paddingLeft: DesignTokens.spacing.md,
                    paddingRight: DesignTokens.spacing.md,
                    paddingTop: DesignTokens.spacing.xl,
                    paddingBottom: DesignTokens.spacing.xl,
                    ...DesignTokens.typography.bodySmall,
                    lineHeight: 0,
                    color: DesignTokens.colors.text.secondary,
                  }}
                >
                  {checkIns.length === 0
                    ? "출역 기록이 없습니다."
                    : "필터 조건에 맞는 기록이 없습니다."}
                </td>
              </tr>
            ) : (
              filteredAndSortedData.map((checkIn) => (
                <tr
                  key={checkIn.id}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.backgroundColor =
                      DesignTokens.colors.background.paper;
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.backgroundColor =
                      DesignTokens.colors.background.default;
                  }}
                  style={{
                    borderTop: `1px solid ${DesignTokens.colors.border.default}`,
                  }}
                >
                  {activeColumns.map((key) => {
                    const column = ALL_COLUMNS[key];
                    if (!column) return null;

                    const value = checkIn[column.key];
                    let displayValue: React.ReactNode = "-";

                    if (key === "timestamp" || key === "checkOutTime") {
                      displayValue = formatTime(value as Timestamp | undefined);
                    } else if (key === "noticeConfirmed") {
                      displayValue = value ? (
                        <span
                          className="inline-flex items-center rounded-full"
                          style={{
                            paddingLeft: DesignTokens.spacing.sm,
                            paddingRight: DesignTokens.spacing.sm,
                            paddingTop: DesignTokens.spacing.xs,
                            paddingBottom: DesignTokens.spacing.xs,
                            ...DesignTokens.typography.caption,
                            lineHeight: 2,
                            fontWeight: 500,
                            backgroundColor:
                              DesignTokens.colors.status.success.bg,
                            color: DesignTokens.colors.status.success.text,
                          }}
                        >
                          확인
                        </span>
                      ) : (
                        <span
                          className="inline-flex items-center rounded-full"
                          style={{
                            paddingLeft: DesignTokens.spacing.sm,
                            paddingRight: DesignTokens.spacing.sm,
                            paddingTop: DesignTokens.spacing.xs,
                            paddingBottom: DesignTokens.spacing.xs,
                            ...DesignTokens.typography.caption,
                            lineHeight: 2,
                            fontWeight: 500,
                            backgroundColor: DesignTokens.colors.status.error.bg,
                            color: DesignTokens.colors.status.error.text,
                          }}
                        >
                          미확인
                        </span>
                      );
                    } else {
                      displayValue = value?.toString() || "-";
                    }

                    return (
                      <td
                        key={key}
                        className="border-r"
                        style={{
                          paddingLeft: DesignTokens.spacing.md,
                          paddingRight: DesignTokens.spacing.md,
                          paddingTop: DesignTokens.spacing.md,
                          paddingBottom: DesignTokens.spacing.md,
                          ...DesignTokens.typography.bodySmall,
                          lineHeight: 0,
                          fontWeight: key === "userName" ? 500 : undefined,
                          color:
                            key === "userName"
                              ? DesignTokens.colors.text.primary
                              : DesignTokens.colors.text.secondary,
                          borderRightColor: DesignTokens.colors.border.default,
                        }}
                      >
                        {displayValue}
                      </td>
                    );
                  })}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default AttendanceList;
