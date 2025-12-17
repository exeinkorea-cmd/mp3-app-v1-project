import React from "react";

const MainTitleSection: React.FC = () => {
  return (
    <div style={{ marginBottom: 40 }}>
      <h1
        style={{
          fontSize: 32,
          fontWeight: 700,
          color: "#111827",
          margin: 0,
          marginBottom: 40,
          padding: 0,
          lineHeight: 0,
        }}
      >
        관리자용 페이지
      </h1>
      <p
        style={{
          fontSize: 16,
          fontWeight: 400,
          color: "#6B7280",
          margin: 0,
          padding: 0,
          lineHeight: 0,
        }}
      >
        현재 현장의 출역정보 확인 및 안전 공지사항을 각 협력사와 팀별로 보낼 수 있습니다.
      </p>
    </div>
  );
};

export default MainTitleSection;

