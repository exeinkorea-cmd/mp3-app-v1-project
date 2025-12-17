/**
 * 디자인 토큰 (Design Tokens)
 * Figma에서 추출한 디자인 시스템의 기본 값들을 정의합니다.
 *
 * 사용 예시:
 * import { DesignTokens } from '../constants/designTokens';
 *
 * <div style={{ padding: DesignTokens.spacing.md }}>
 *   <h1 style={{ ...DesignTokens.typography.h1 }}>제목</h1>
 * </div>
 */

export const DesignTokens = {
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

  // 간격 토큰 (spacing)
  spacing: {
    xs: 4,
    sm: 8,
    md: 16,
    lg: 24,
    xl: 32,
    xxl: 48,
  },

  // 타이포그래피 토큰 (Data-Dense 대시보드 스타일)
  typography: {
    h1: {
      fontSize: 32,
      fontWeight: 700,
      lineHeight: 1.2, // Data-Dense: 40 → 1.2 (폰트 크기의 1.2배)
    },
    h2: {
      fontSize: 24,
      fontWeight: 600,
      lineHeight: 1.2, // Data-Dense: 32 → 1.2
    },
    h3: {
      fontSize: 18, // Figma: --text-lg (1.125rem)
      fontWeight: 500, // Figma: var(--font-weight-medium)
      lineHeight: 1.2, // Data-Dense: 24 → 1.2
    },
    h4: {
      fontSize: 18, // Figma: --text-lg
      fontWeight: 500, // Figma: var(--font-weight-medium)
      lineHeight: 1.2, // Data-Dense: 24 → 1.2
    },
    body: {
      fontSize: 16,
      fontWeight: 400,
      lineHeight: 1.4, // Data-Dense: 24 → 1.4 (폰트 크기의 1.4배)
    },
    bodyMedium: {
      fontSize: 15, // body(16px)와 bodySmall(14px) 사이의 중간 크기
      fontWeight: 400,
      lineHeight: 1.4, // Data-Dense: 22 → 1.4
    },
    bodySmall: {
      fontSize: 14, // Figma: --font-size (base)
      fontWeight: 400, // Figma: var(--font-weight-normal)
      lineHeight: 1.4, // Data-Dense: 20 → 1.4
    },
    caption: {
      fontSize: 12,
      fontWeight: 400,
      lineHeight: 1.4, // Data-Dense: 16 → 1.4
    },
  },

  // 둥근 모서리 토큰 (Figma 디자인 토큰 값 적용)
  borderRadius: {
    sm: 4,
    md: 8,
    lg: 10, // Figma: --radius (0.625rem = 10px)
    xl: 16,
    full: 9999,
  },

  // 그림자 토큰 (CSS용)
  shadows: {
    sm: "0 1px 2px 0 rgba(0, 0, 0, 0.05)",
    md: "0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06)",
    lg: "0 10px 15px -3px rgba(0, 0, 0, 0.1), 0 4px 6px -2px rgba(0, 0, 0, 0.05)",
  },

  // 레이아웃 토큰
  layout: {
    headerHeight: 64, // h-16
    containerMaxWidth: 1280,
    sidebarWidth: 256,
  },

  // 높이 토큰 (Figma 디자인 값)
  heights: {
    card: 512, // 카드 전체 높이
    titleInput: 28, // 제목 입력창 (h-7)
    contentInput: 400, // 내용 입력창 (h-[400px])
    buttonSmall: 32, // 버튼 sm 사이즈 (h-8)
    buttonDefault: 36, // 버튼 기본 사이즈 (h-9)
  },

  // 버튼 패딩 토큰 (Figma 디자인 값)
  buttonPadding: {
    small: {
      horizontal: 12, // px-3
      vertical: 8, // py-2
    },
    default: {
      horizontal: 16, // px-4
      vertical: 8, // py-2
    },
  },

  // Z-index 토큰
  zIndex: {
    dropdown: 100,
    modal: 50,
    header: 10,
    tooltip: 1000,
  },
};

// Tailwind CSS 클래스 매핑 (디자인 토큰과 Tailwind를 함께 사용할 때)
export const TailwindClassMap = {
  colors: {
    primary: "bg-blue-600 hover:bg-blue-700",
    secondary: "bg-green-500 hover:bg-green-600",
    text: {
      primary: "text-gray-800",
      secondary: "text-gray-500",
    },
  },
  spacing: {
    xs: "p-1",
    sm: "p-2",
    md: "p-4",
    lg: "p-6",
  },
};
