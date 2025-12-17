import React from "react";
import { Filter, Share, MoreHorizontal, User, AlertTriangle, LogOut } from "lucide-react";
import { DashboardHeaderProps } from "../types";
import { DesignTokens } from "../constants/designTokens";

const DashboardHeader: React.FC<DashboardHeaderProps> = ({
  onLogout,
  onManualReset,
  isResetting = false,
  onRevokeSessions,
  isRevoking = false,
}) => {
  return (
    <div
      className="flex items-center justify-between bg-white border-b"
      style={{
        height: DesignTokens.layout.headerHeight,
        paddingLeft: DesignTokens.spacing.lg,
        paddingRight: DesignTokens.spacing.lg,
        borderColor: DesignTokens.colors.border.default,
      }}
    >
      <div
        className="flex items-center"
        style={{ gap: DesignTokens.spacing.md }}
      >
        <div
          style={{
            ...DesignTokens.typography.h4,
            lineHeight: 0,
            color: DesignTokens.colors.text.primary,
          }}
        >
          GS 건설 아테라자이 현장
        </div>
      </div>
      <div
        className="flex items-center"
        style={{ gap: DesignTokens.spacing.sm }}
      >
        {/* 전체 강제 로그아웃 버튼 (주황색) */}
        <button
          onClick={onRevokeSessions}
          disabled={isRevoking}
          className="transition-colors rounded"
          style={{
            padding: DesignTokens.spacing.sm,
            color: isRevoking ? "#9CA3AF" : "#F97316", // 주황색 (orange-500)
            cursor: isRevoking ? "not-allowed" : "pointer",
            opacity: isRevoking ? 0.6 : 1,
          }}
          onMouseEnter={(e) => {
            if (!isRevoking) {
              e.currentTarget.style.color = "#EA580C"; // orange-600
            }
          }}
          onMouseLeave={(e) => {
            if (!isRevoking) {
              e.currentTarget.style.color = "#F97316"; // orange-500
            }
          }}
          title={isRevoking ? "로그아웃 처리 중..." : "🚪 전체 강제 로그아웃 (Debug)"}
        >
          <LogOut className="w-5 h-5" />
        </button>
        {/* 데이터 초기화 버튼 (빨간색) */}
        <button
          onClick={onManualReset}
          disabled={isResetting}
          className="transition-colors rounded"
          style={{
            padding: DesignTokens.spacing.sm,
            color: isResetting ? "#9CA3AF" : "#DC2626", // 빨간색
            cursor: isResetting ? "not-allowed" : "pointer",
            opacity: isResetting ? 0.6 : 1,
          }}
          onMouseEnter={(e) => {
            if (!isResetting) {
              e.currentTarget.style.color = "#B91C1C";
            }
          }}
          onMouseLeave={(e) => {
            if (!isResetting) {
              e.currentTarget.style.color = "#DC2626";
            }
          }}
          title={isResetting ? "초기화 중..." : "⚡ 데이터 초기화 (Debug)"}
        >
          <AlertTriangle className="w-5 h-5" />
        </button>
        <button
          className="transition-colors rounded"
          style={{
            padding: DesignTokens.spacing.sm,
            color: DesignTokens.colors.text.secondary,
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.color = DesignTokens.colors.text.primary;
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.color = DesignTokens.colors.text.secondary;
          }}
        >
          <Filter className="w-5 h-5" />
        </button>
        <button
          className="transition-colors rounded"
          style={{
            padding: DesignTokens.spacing.sm,
            color: DesignTokens.colors.text.secondary,
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.color = DesignTokens.colors.text.primary;
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.color = DesignTokens.colors.text.secondary;
          }}
        >
          <Share className="w-5 h-5" />
        </button>
        <button
          className="transition-colors rounded"
          style={{
            padding: DesignTokens.spacing.sm,
            color: DesignTokens.colors.text.secondary,
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.color = DesignTokens.colors.text.primary;
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.color = DesignTokens.colors.text.secondary;
          }}
        >
          <MoreHorizontal className="w-5 h-5" />
        </button>
        <button
          onClick={onLogout}
          className="transition-colors rounded"
          style={{
            padding: DesignTokens.spacing.sm,
            color: DesignTokens.colors.text.secondary,
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.color = DesignTokens.colors.text.primary;
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.color = DesignTokens.colors.text.secondary;
          }}
          title="로그아웃"
        >
          <User className="w-5 h-5" />
        </button>
      </div>
    </div>
  );
};

export default DashboardHeader;
