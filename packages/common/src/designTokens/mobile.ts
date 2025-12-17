/**
 * 모바일용 디자인 토큰 (Mobile Design Tokens)
 * React Native 모바일 애플리케이션에서 사용하는 디자인 토큰입니다.
 * 
 * 사용 예시:
 * import { MobileDesignTokens } from "@mp3/common/designTokens/mobile";
 * 
 * <View style={[styles.container, { padding: MobileDesignTokens.spacing.md }]}>
 *   <Text style={[styles.title, MobileDesignTokens.typography.h1]}>제목</Text>
 * </View>
 */

import { BaseDesignTokens } from "./index";

export const MobileDesignTokens = {
  ...BaseDesignTokens,

  // 둥근 모서리 토큰 (모바일은 약간 다름)
  borderRadius: {
    ...BaseDesignTokens.borderRadius,
    lg: 12, // 모바일은 12px (웹은 10px)
  },

  // 타이포그래피 토큰 - React Native StyleSheet용
  typography: {
    h1: {
      fontSize: 32,
      fontWeight: "700" as const,
      lineHeight: 40,
    },
    h2: {
      fontSize: 24,
      fontWeight: "600" as const,
      lineHeight: 32,
    },
    h3: {
      fontSize: 20,
      fontWeight: "600" as const,
      lineHeight: 28,
    },
    h4: {
      fontSize: 18,
      fontWeight: "600" as const,
      lineHeight: 24,
    },
    body: {
      fontSize: 16,
      fontWeight: "400" as const,
      lineHeight: 24,
    },
    bodySmall: {
      fontSize: 14,
      fontWeight: "400" as const,
      lineHeight: 20,
    },
    caption: {
      fontSize: 12,
      fontWeight: "400" as const,
      lineHeight: 16,
    },
  },

  // 그림자 토큰 (React Native용)
  shadows: {
    sm: {
      shadowColor: "#000",
      shadowOffset: { width: 0, height: 1 },
      shadowOpacity: 0.05,
      shadowRadius: 2,
      elevation: 1,
    },
    md: {
      shadowColor: "#000",
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.1,
      shadowRadius: 4,
      elevation: 3,
    },
    lg: {
      shadowColor: "#000",
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.15,
      shadowRadius: 8,
      elevation: 5,
    },
  },

  // 레이아웃 토큰 (모바일 전용)
  layout: {
    headerHeight: 64,
    containerPadding: 20,
    cardPadding: 16,
  },

  // z-index 토큰 (모바일은 다른 값 사용)
  zIndex: {
    dropdown: 1000,
    modal: 2000,
    tooltip: 3000,
  },
};









