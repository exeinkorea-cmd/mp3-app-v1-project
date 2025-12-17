import React, { useState, useEffect } from "react";
import { RefreshCw } from "lucide-react";
import { collection, query, onSnapshot, Timestamp } from "firebase/firestore";
import { db } from "../firebase";
import { DesignTokens } from "../constants/designTokens";

interface StatsCardsProps {}

const StatsCards: React.FC<StatsCardsProps> = () => {
  const [lastUpdate, setLastUpdate] = useState<Date>(new Date());
  const [currentAttendance, setCurrentAttendance] = useState<number>(0);
  const [currentPartners, setCurrentPartners] = useState<number>(0);

  // 현재 로그인된 사용자 데이터 계산
  useEffect(() => {
    const q = query(collection(db, "authCheckIns"));

    const unsubscribe = onSnapshot(
      q,
      (querySnapshot) => {
        // 사용자별로 가장 최근 checkIn 기록만 추적
        const userLatestCheckIn = new Map<string, any>();

        querySnapshot.forEach((doc) => {
          const data = doc.data();
          // 사용자 식별자: userEmail 또는 phoneNumber 사용
          const userId = data.userEmail || data.phoneNumber || doc.id;
          
          // 기존 기록이 없거나, 현재 기록이 더 최신인 경우
          if (!userLatestCheckIn.has(userId) || 
              (data.timestamp && 
               (!userLatestCheckIn.get(userId)?.timestamp || 
                data.timestamp.toMillis() > userLatestCheckIn.get(userId).timestamp.toMillis()))) {
            userLatestCheckIn.set(userId, data);
          }
        });

        // checkOutTime이 없는 사용자만 카운트 (현재 로그인된 상태)
        let loggedInCount = 0;
        const partnerSet = new Set<string>();

        userLatestCheckIn.forEach((checkIn) => {
          if (!checkIn.checkOutTime) {
            loggedInCount++;
            if (checkIn.department) {
              partnerSet.add(checkIn.department);
            }
          }
        });

        setCurrentAttendance(loggedInCount);
        setCurrentPartners(partnerSet.size);
        setLastUpdate(new Date());
      },
      (error) => {
        console.error("출역 데이터 수신 오류:", error);
      }
    );

    return () => unsubscribe();
  }, []);

  const formatTime = (date: Date): string => {
    const hours = date.getHours();
    const minutes = date.getMinutes();
    const seconds = date.getSeconds();
    const ampm = hours >= 12 ? "오후" : "오전";
    const displayHours = hours % 12 || 12;
    return `${ampm} ${displayHours}:${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
  };

  const handleRefresh = () => {
    setLastUpdate(new Date());
  };

  const cardStyle: React.CSSProperties = {
    flex: 1,
    backgroundColor: DesignTokens.colors.background.default,
    borderRadius: 10,
    padding: "24px",
    display: "flex",
    flexDirection: "column",
    justifyContent: "space-between",
    minHeight: "140px",
    position: "relative",
    boxShadow: DesignTokens.shadows.sm,
    border: `1px solid ${DesignTokens.colors.border.default}`,
  };

  const cardTitleStyle: React.CSSProperties = {
    fontSize: 14,
    fontWeight: 500,
    color: "#6B7280",
    margin: 0,
    marginBottom: 34,
    padding: 0,
    lineHeight: 0,
  };

  const cardValueStyle: React.CSSProperties = {
    fontSize: 32,
    fontWeight: 700,
    color: "#111827",
    margin: 0,
    padding: 0,
    lineHeight: 0,
  };

  const cardFooterStyle: React.CSSProperties = {
    fontSize: 12,
    color: "#9CA3AF",
    marginTop: 16,
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    lineHeight: 0,
  };

  return (
    <div
      style={{
        display: "flex",
        gap: 16,
        marginBottom: 4,
        marginTop: 4,
      }}
    >
      {/* 현재 출역 인원 */}
      <div style={cardStyle}>
        <div>
          <h3 style={cardTitleStyle}>현재 출역 인원</h3>
          <div style={cardValueStyle}>{currentAttendance.toLocaleString()}</div>
        </div>
        <div style={cardFooterStyle}>
          <span>마지막 업데이트: {formatTime(lastUpdate)}</span>
          <button
            onClick={handleRefresh}
            style={{
              background: "none",
              border: "none",
              cursor: "pointer",
              padding: 4,
              display: "flex",
              alignItems: "center",
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.opacity = "0.7";
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.opacity = "1";
            }}
          >
            <RefreshCw style={{ width: 16, height: 16, color: "#9CA3AF" }} />
          </button>
        </div>
      </div>

      {/* 현재 출역 협력사 */}
      <div style={cardStyle}>
        <div>
          <h3 style={cardTitleStyle}>현재 출역 협력사</h3>
          <div style={cardValueStyle}>{currentPartners.toLocaleString()}</div>
        </div>
        <div style={cardFooterStyle}>
          <span>마지막 업데이트: {formatTime(lastUpdate)}</span>
          <button
            onClick={handleRefresh}
            style={{
              background: "none",
              border: "none",
              cursor: "pointer",
              padding: 4,
              display: "flex",
              alignItems: "center",
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.opacity = "0.7";
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.opacity = "1";
            }}
          >
            <RefreshCw style={{ width: 16, height: 16, color: "#9CA3AF" }} />
          </button>
        </div>
      </div>

      {/* 금일 온도 */}
      <div style={cardStyle}>
        <div>
          <h3 style={cardTitleStyle}>금일 온도</h3>
          <div style={cardValueStyle}>-</div>
        </div>
        <div style={cardFooterStyle}>
          <span>마지막 업데이트: {formatTime(lastUpdate)}</span>
          <button
            onClick={handleRefresh}
            style={{
              background: "none",
              border: "none",
              cursor: "pointer",
              padding: 4,
              display: "flex",
              alignItems: "center",
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.opacity = "0.7";
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.opacity = "1";
            }}
          >
            <RefreshCw style={{ width: 16, height: 16, color: "#9CA3AF" }} />
          </button>
        </div>
      </div>

      {/* 금일 풍속 */}
      <div style={cardStyle}>
        <div>
          <h3 style={cardTitleStyle}>금일 풍속</h3>
          <div style={cardValueStyle}>-</div>
        </div>
        <div style={cardFooterStyle}>
          <span>마지막 업데이트: {formatTime(lastUpdate)}</span>
          <button
            onClick={handleRefresh}
            style={{
              background: "none",
              border: "none",
              cursor: "pointer",
              padding: 4,
              display: "flex",
              alignItems: "center",
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.opacity = "0.7";
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.opacity = "1";
            }}
          >
            <RefreshCw style={{ width: 16, height: 16, color: "#9CA3AF" }} />
          </button>
        </div>
      </div>
    </div>
  );
};

export default StatsCards;

