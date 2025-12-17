/**
 * 웹용 디자인 토큰 (Web Design Tokens)
 * React 웹 애플리케이션에서 사용하는 디자인 토큰입니다.
 * 
 * 사용 예시:
 * import { WebDesignTokens } from "@mp3/common/designTokens/web";
 * 
 * <div style={{ padding: WebDesignTokens.spacing.md }}>
 *   <h1 style={{ ...WebDesignTokens.typography.h1 }}>제목</h1>
 * </div>
 */

import { BaseDesignTokens } from "./index";

export const WebDesignTokens = {
  ...BaseDesignTokens,

  // 타이포그래피 토큰 (Data-Dense 대시보드 스타일) - 웹용
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

  // 그림자 토큰 (CSS용)
  shadows: {
    sm: "0 1px 2px 0 rgba(0, 0, 0, 0.05)",
    md: "0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06)",
    lg: "0 10px 15px -3px rgba(0, 0, 0, 0.1), 0 4px 6px -2px rgba(0, 0, 0, 0.05)",
  },

  // 레이아웃 토큰 (웹 전용)
  layout: {
    headerHeight: 64, // h-16
    containerMaxWidth: 1280,
    sidebarWidth: 256,
  },

  // 높이 토큰 (Figma 디자인 값) - 웹 전용
  heights: {
    card: 512, // 카드 전체 높이
    titleInput: 28, // 제목 입력창 (h-7)
    contentInput: 400, // 내용 입력창 (h-[400px])
    buttonSmall: 32, // 버튼 sm 사이즈 (h-8)
    buttonDefault: 36, // 버튼 기본 사이즈 (h-9)
  },

  // 버튼 패딩 토큰 (Figma 디자인 값) - 웹 전용
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


