import React, { useState, useEffect } from "react";
import {
  collection,
  query,
  onSnapshot,
  orderBy,
  Timestamp,
} from "firebase/firestore";
import { db } from "../firebase";
import { AuthCheckIn } from "../types";
import { Download, Filter, RefreshCw } from "lucide-react";
import { DesignTokens } from "../constants/designTokens";

const AttendanceList: React.FC = () => {
  const [checkIns, setCheckIns] = useState<AuthCheckIn[]>([]);

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
          현재 출역 현황 (오전 1시에 자동 초기화 됩니다.)
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
            title="필터"
          >
            <Filter
              className="w-4 h-4"
              style={{ color: DesignTokens.colors.text.secondary }}
            />
          </button>
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
            title="새로고침"
          >
            <RefreshCw
              className="w-4 h-4"
              style={{ color: DesignTokens.colors.text.secondary }}
            />
          </button>
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
                이름
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
                소속
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
                출근시간
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
                퇴근시간
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
                고위험 작업
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
                공지 확인
              </th>
            </tr>
          </thead>
          <tbody
            style={{
              backgroundColor: DesignTokens.colors.background.default,
            }}
          >
            {checkIns.length === 0 ? (
              <tr>
                <td
                  colSpan={7}
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
                  출역 기록이 없습니다.
                </td>
              </tr>
            ) : (
              checkIns.map((checkIn) => (
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
                    {checkIn.userName || "-"}
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
                    {checkIn.phoneNumber || "-"}
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
                    {checkIn.department || "-"}
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
                    {checkIn.timestamp ? formatTime(checkIn.timestamp) : "-"}
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
                    {checkIn.checkOutTime
                      ? formatTime(checkIn.checkOutTime)
                      : "-"}
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
                    {checkIn.highRiskWork || "-"}
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
                      borderRightColor: DesignTokens.colors.border.default,
                    }}
                  >
                    {checkIn.noticeConfirmed ? (
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
                    )}
                  </td>
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
