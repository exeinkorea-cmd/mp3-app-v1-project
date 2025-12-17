import React, { useState, useEffect } from "react";
import {
  collection,
  query,
  onSnapshot,
  orderBy,
  updateDoc,
  doc,
  addDoc,
  serverTimestamp,
  Timestamp,
  getDocs,
  where,
} from "firebase/firestore";
import { db } from "../firebase";
import { DesignTokens } from "../constants/designTokens";
import { Check, X, Plus } from "lucide-react";
import { TeamRequest } from "../types";

const TeamRequestList: React.FC = () => {
  const [requests, setRequests] = useState<TeamRequest[]>([]);
  const [newTeamName, setNewTeamName] = useState<string>("");
  const [isAdding, setIsAdding] = useState<boolean>(false);

  // teamRequests 컬렉션에서 실시간 데이터 수신
  useEffect(() => {
    const q = query(
      collection(db, "teamRequests"),
      orderBy("timestamp", "desc")
    );

    const unsubscribe = onSnapshot(
      q,
      (querySnapshot) => {
        const docs: TeamRequest[] = [];
        querySnapshot.forEach((doc) => {
          docs.push({ id: doc.id, ...doc.data() } as TeamRequest);
        });
        setRequests(docs);
        console.log("소속 요청 목록 수신:", docs.length, "개");
      },
      (error) => {
        console.error("소속 요청 데이터 수신 오류:", error);
      }
    );

    return () => unsubscribe();
  }, []);

  // 시간 포맷 헬퍼 함수
  const formatTime = (timestamp: Timestamp | undefined): string => {
    if (!timestamp) return "-";
    try {
      if (timestamp instanceof Timestamp) {
        const date = timestamp.toDate();
        return date.toLocaleString("ko-KR", {
          year: "numeric",
          month: "2-digit",
          day: "2-digit",
          hour: "2-digit",
          minute: "2-digit",
        });
      }
      return "-";
    } catch (e) {
      return "-";
    }
  };

  // 요청 승인 처리
  const handleApprove = async (request: TeamRequest): Promise<void> => {
    if (!window.confirm(`"${request.requestedTeamName}" 소속을 승인하시겠습니까?`)) {
      return;
    }

    try {
      // 1. teamRequests 문서 상태 업데이트
      const requestRef = doc(db, "teamRequests", request.id);
      await updateDoc(requestRef, {
        status: "approved",
        approvedAt: serverTimestamp(),
      });

      // 2. departments 컬렉션에 새 소속 추가
      await addDoc(collection(db, "departments"), {
        name: request.requestedTeamName,
        createdAt: serverTimestamp(),
      });

      alert(`"${request.requestedTeamName}" 소속이 승인되었습니다.`);
    } catch (error) {
      console.error("요청 승인 오류:", error);
      const errorMessage =
        error instanceof Error ? error.message : "알 수 없는 오류";
      alert(`요청 승인 실패: ${errorMessage}`);
    }
  };

  // 요청 거부 처리
  const handleReject = async (request: TeamRequest): Promise<void> => {
    if (!window.confirm(`"${request.requestedTeamName}" 소속 요청을 거부하시겠습니까?`)) {
      return;
    }

    try {
      const requestRef = doc(db, "teamRequests", request.id);
      await updateDoc(requestRef, {
        status: "rejected",
        rejectedAt: serverTimestamp(),
      });

      alert(`"${request.requestedTeamName}" 소속 요청이 거부되었습니다.`);
    } catch (error) {
      console.error("요청 거부 오류:", error);
      const errorMessage =
        error instanceof Error ? error.message : "알 수 없는 오류";
      alert(`요청 거부 실패: ${errorMessage}`);
    }
  };

  // 관리자 직권 팀 추가 처리
  const handleDirectAdd = async (): Promise<void> => {
    const trimmedName = newTeamName.trim();

    // 빈 값 검증
    if (!trimmedName) {
      alert("소속명을 입력해주세요.");
      return;
    }

    setIsAdding(true);

    try {
      // 중복 이름 체크
      const departmentsQuery = query(
        collection(db, "departments"),
        where("name", "==", trimmedName)
      );
      const existingDocs = await getDocs(departmentsQuery);

      if (!existingDocs.empty) {
        alert(`"${trimmedName}" 소속이 이미 존재합니다.`);
        setIsAdding(false);
        return;
      }

      // departments 컬렉션에 새 소속 추가 (기본값: team)
      await addDoc(collection(db, "departments"), {
        name: trimmedName,
        type: "team", // 기본값
        createdAt: serverTimestamp(),
      });

      alert(`"${trimmedName}" 소속이 추가되었습니다.`);
      setNewTeamName(""); // input 초기화
    } catch (error) {
      console.error("직권 팀 추가 오류:", error);
      const errorMessage =
        error instanceof Error ? error.message : "알 수 없는 오류";
      alert(`소속 추가 실패: ${errorMessage}`);
    } finally {
      setIsAdding(false);
    }
  };

  // Enter 키 처리
  const handleKeyPress = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter" && !isAdding) {
      handleDirectAdd();
    }
  };

  // pending 상태의 요청만 필터링
  const pendingRequests = requests.filter((req) => req.status === "pending");

  return (
    <div
      style={{
        backgroundColor: DesignTokens.colors.background.default,
        padding: "24px",
        borderRadius: "10px",
        border: `1px solid ${DesignTokens.colors.border.default}`,
        boxShadow: "0 1px 2px 0 rgba(0, 0, 0, 0.05)",
        marginTop: DesignTokens.spacing.lg,
      }}
    >
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
          소속 추가 요청 ({pendingRequests.length})
        </h2>
      </div>

      {/* 관리자 직권 팀 추가 영역 */}
      <div
        className="flex gap-2 items-center"
        style={{ marginBottom: DesignTokens.spacing.lg }}
      >
        <input
          type="text"
          value={newTeamName}
          onChange={(e) => setNewTeamName(e.target.value)}
          onKeyPress={handleKeyPress}
          placeholder="새 소속명 입력"
          disabled={isAdding}
          className="flex-1 px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
          style={{
            borderColor: DesignTokens.colors.border.default,
            ...DesignTokens.typography.body,
            backgroundColor: DesignTokens.colors.background.default,
          }}
        />
        <button
          onClick={handleDirectAdd}
          disabled={isAdding || !newTeamName.trim()}
          className="flex items-center gap-2 px-4 py-2 bg-blue-500 text-white rounded-md hover:bg-blue-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          style={{
            ...DesignTokens.typography.body,
            fontWeight: 500,
          }}
        >
          <Plus size={18} />
          <span>추가</span>
        </button>
      </div>

      {/* 테이블 */}
      {pendingRequests.length === 0 ? (
        <div
          style={{
            padding: DesignTokens.spacing.xl,
            textAlign: "center",
            color: DesignTokens.colors.text.secondary,
            ...DesignTokens.typography.body,
          }}
        >
          대기 중인 요청이 없습니다.
        </div>
      ) : (
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
                <th
                  className="text-left uppercase tracking-wider border-r"
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
                  }}
                >
                  요청자
                </th>
                <th
                  className="text-left uppercase tracking-wider border-r"
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
                  }}
                >
                  전화번호
                </th>
                <th
                  className="text-left uppercase tracking-wider border-r"
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
                  }}
                >
                  요청 소속명
                </th>
                <th
                  className="text-left uppercase tracking-wider border-r"
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
                  }}
                >
                  요청 시간
                </th>
                <th
                  className="text-left uppercase tracking-wider"
                  style={{
                    paddingLeft: DesignTokens.spacing.md,
                    paddingRight: DesignTokens.spacing.md,
                    paddingTop: DesignTokens.spacing.md,
                    paddingBottom: DesignTokens.spacing.md,
                    ...DesignTokens.typography.caption,
                    lineHeight: 0,
                    fontWeight: 500,
                    color: DesignTokens.colors.text.secondary,
                  }}
                >
                  작업
                </th>
              </tr>
            </thead>
            <tbody
              style={{
                backgroundColor: DesignTokens.colors.background.default,
              }}
            >
              {pendingRequests.map((request) => (
                <tr
                  key={request.id}
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
                  <td
                    className="border-r"
                    style={{
                      paddingLeft: DesignTokens.spacing.md,
                      paddingRight: DesignTokens.spacing.md,
                      paddingTop: DesignTokens.spacing.md,
                      paddingBottom: DesignTokens.spacing.md,
                      ...DesignTokens.typography.bodySmall,
                      lineHeight: 0,
                      fontWeight: 500,
                      color: DesignTokens.colors.text.primary,
                      borderRightColor: DesignTokens.colors.border.default,
                    }}
                  >
                    {request.requesterName || "-"}
                  </td>
                  <td
                    className="border-r"
                    style={{
                      paddingLeft: DesignTokens.spacing.md,
                      paddingRight: DesignTokens.spacing.md,
                      paddingTop: DesignTokens.spacing.md,
                      paddingBottom: DesignTokens.spacing.md,
                      ...DesignTokens.typography.bodySmall,
                      lineHeight: 0,
                      color: DesignTokens.colors.text.secondary,
                      borderRightColor: DesignTokens.colors.border.default,
                    }}
                  >
                    {request.phoneNumber || "-"}
                  </td>
                  <td
                    className="border-r"
                    style={{
                      paddingLeft: DesignTokens.spacing.md,
                      paddingRight: DesignTokens.spacing.md,
                      paddingTop: DesignTokens.spacing.md,
                      paddingBottom: DesignTokens.spacing.md,
                      ...DesignTokens.typography.bodySmall,
                      lineHeight: 0,
                      fontWeight: 500,
                      color: DesignTokens.colors.text.primary,
                      borderRightColor: DesignTokens.colors.border.default,
                    }}
                  >
                    {request.requestedTeamName || "-"}
                  </td>
                  <td
                    className="border-r"
                    style={{
                      paddingLeft: DesignTokens.spacing.md,
                      paddingRight: DesignTokens.spacing.md,
                      paddingTop: DesignTokens.spacing.md,
                      paddingBottom: DesignTokens.spacing.md,
                      ...DesignTokens.typography.bodySmall,
                      lineHeight: 0,
                      color: DesignTokens.colors.text.secondary,
                      borderRightColor: DesignTokens.colors.border.default,
                    }}
                  >
                    {formatTime(request.timestamp)}
                  </td>
                  <td
                    style={{
                      paddingLeft: DesignTokens.spacing.md,
                      paddingRight: DesignTokens.spacing.md,
                      paddingTop: DesignTokens.spacing.md,
                      paddingBottom: DesignTokens.spacing.md,
                      ...DesignTokens.typography.bodySmall,
                      lineHeight: 0,
                    }}
                  >
                    <div
                      style={{
                        display: "flex",
                        gap: DesignTokens.spacing.sm,
                        alignItems: "center",
                      }}
                    >
                      <button
                        onClick={() => handleApprove(request)}
                        className="transition-colors"
                        style={{
                          padding: DesignTokens.spacing.xs,
                          borderRadius: DesignTokens.borderRadius.sm,
                          backgroundColor: DesignTokens.colors.status.success.bg,
                          color: DesignTokens.colors.status.success.text,
                          border: "none",
                          cursor: "pointer",
                          display: "flex",
                          alignItems: "center",
                          gap: DesignTokens.spacing.xs,
                        }}
                        onMouseEnter={(e) => {
                          e.currentTarget.style.opacity = "0.8";
                        }}
                        onMouseLeave={(e) => {
                          e.currentTarget.style.opacity = "1";
                        }}
                      >
                        <Check size={16} />
                        <span>승인</span>
                      </button>
                      <button
                        onClick={() => handleReject(request)}
                        className="transition-colors"
                        style={{
                          padding: DesignTokens.spacing.xs,
                          borderRadius: DesignTokens.borderRadius.sm,
                          backgroundColor: DesignTokens.colors.status.error.bg,
                          color: DesignTokens.colors.status.error.text,
                          border: "none",
                          cursor: "pointer",
                          display: "flex",
                          alignItems: "center",
                          gap: DesignTokens.spacing.xs,
                        }}
                        onMouseEnter={(e) => {
                          e.currentTarget.style.opacity = "0.8";
                        }}
                        onMouseLeave={(e) => {
                          e.currentTarget.style.opacity = "1";
                        }}
                      >
                        <X size={16} />
                        <span>거부</span>
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};

export default TeamRequestList;

