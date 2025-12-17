/**
 * 공통 디자인 토큰 (Base Design Tokens)
 * 모든 플랫폼(웹, 모바일)에서 공유하는 기본 디자인 값들을 정의합니다.
 * 
 * 플랫폼별 특화 토큰은 web.ts, mobile.ts를 참조하세요.
 */

export const BaseDesignTokens = {
  // 색상 토큰 (Figma 디자인 토큰 값 적용)
  colors: {
    // Primary 색상
    primary: {
      main: "#030213", // Figma: var(--primary)
      light: "#030213",
      dark: "#030213",
      hover: "#030213",
    },
    // Secondary 색상
    secondary: {
      main: "#10B981", // green-500
      light: "#34D399", // green-400
      dark: "#059669", // green-600
    },
    // 배경 색상
    background: {
      default: "#ffffff", // Figma: var(--card), bg-white
      paper: "#F9FAFB", // gray-50
      secondary: "#F3F4F6", // gray-100
    },
    // 텍스트 색상
    text: {
      primary: "#030213", // Figma: var(--foreground)
      secondary: "rgb(17, 24, 39)", // Figma: text-gray-900
      disabled: "#9CA3AF", // gray-400
      inverse: "#FFFFFF",
    },
    // 테두리 색상
    border: {
      default: "rgba(0, 0, 0, 0.1)", // Figma: var(--border)
      light: "#F3F4F6", // gray-100
      dark: "rgb(209, 213, 219)", // Figma: border-gray-300
    },
    // 상태 색상
    status: {
      success: {
        bg: "#D1FAE5", // green-100
        text: "#065F46", // green-800
      },
      error: {
        bg: "#FEE2E2", // red-100
        text: "#991B1B", // red-800
      },
      warning: {
        bg: "#FEF3C7", // yellow-100
        text: "#92400E", // yellow-800
      },
      info: {
        bg: "#DBEAFE", // blue-100
        text: "#1E40AF", // blue-800
      },
    },
  },

  // 간격 토큰 (spacing) - 모든 플랫폼에서 동일
  spacing: {
    xs: 4,
    sm: 8,
    md: 16,
    lg: 24,
    xl: 32,
    xxl: 48,
  },

  // 둥근 모서리 토큰 (Figma 디자인 토큰 값 적용)
  borderRadius: {
    sm: 4,
    md: 8,
    lg: 10, // Figma: --radius (0.625rem = 10px)
    xl: 16,
    full: 9999,
  },

  // Z-index 토큰 (웹 기준, 모바일은 별도 정의)
  zIndex: {
    dropdown: 100,
    modal: 50,
    header: 10,
    tooltip: 1000,
  },
};

