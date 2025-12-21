"use strict";
/**
 * 모바일용 디자인 토큰 (Mobile Design Tokens)
 * React Native 모바일 애플리케이션에서 사용하는 디자인 토큰입니다.
 *
 * ⚠️ React 타입 사용 시 주의사항:
 * - mobiles 패키지에서 react@19.1.0 사용
 * - React Native의 ViewStyle, TextStyle 등을 사용할 경우
 *   react@19.1.0과 react-native의 타입 정의를 따릅니다.
 * - web-cms(react@19.2.0)와 버전이 다르므로 타입 공유 시 주의 필요
 *
 * 사용 예시:
 * import { MobileDesignTokens } from "@mp3/common/designTokens/mobile";
 *
 * <View style={[styles.container, { padding: MobileDesignTokens.spacing.md }]}>
 *   <Text style={[styles.title, MobileDesignTokens.typography.h1]}>제목</Text>
 * </View>
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.MobileDesignTokens = void 0;
const index_1 = require("./index");
exports.MobileDesignTokens = Object.assign(Object.assign({}, index_1.BaseDesignTokens), { 
    // 둥근 모서리 토큰 (모바일은 약간 다름)
    borderRadius: Object.assign(Object.assign({}, index_1.BaseDesignTokens.borderRadius), { lg: 12 }), 
    // 타이포그래피 토큰 - React Native StyleSheet용
    typography: {
        h1: {
            fontSize: 32,
            fontWeight: "700",
            lineHeight: 40,
        },
        h2: {
            fontSize: 24,
            fontWeight: "600",
            lineHeight: 32,
        },
        h3: {
            fontSize: 20,
            fontWeight: "600",
            lineHeight: 28,
        },
        h4: {
            fontSize: 18,
            fontWeight: "600",
            lineHeight: 24,
        },
        body: {
            fontSize: 16,
            fontWeight: "400",
            lineHeight: 24,
        },
        bodySmall: {
            fontSize: 14,
            fontWeight: "400",
            lineHeight: 20,
        },
        caption: {
            fontSize: 12,
            fontWeight: "400",
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
    } });
//# sourceMappingURL=mobile.js.map