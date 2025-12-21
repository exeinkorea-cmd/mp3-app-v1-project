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
export declare const MobileDesignTokens: {
    borderRadius: {
        lg: number;
        sm: number;
        md: number;
        xl: number;
        full: number;
    };
    typography: {
        h1: {
            fontSize: number;
            fontWeight: "700";
            lineHeight: number;
        };
        h2: {
            fontSize: number;
            fontWeight: "600";
            lineHeight: number;
        };
        h3: {
            fontSize: number;
            fontWeight: "600";
            lineHeight: number;
        };
        h4: {
            fontSize: number;
            fontWeight: "600";
            lineHeight: number;
        };
        body: {
            fontSize: number;
            fontWeight: "400";
            lineHeight: number;
        };
        bodySmall: {
            fontSize: number;
            fontWeight: "400";
            lineHeight: number;
        };
        caption: {
            fontSize: number;
            fontWeight: "400";
            lineHeight: number;
        };
    };
    shadows: {
        sm: {
            shadowColor: string;
            shadowOffset: {
                width: number;
                height: number;
            };
            shadowOpacity: number;
            shadowRadius: number;
            elevation: number;
        };
        md: {
            shadowColor: string;
            shadowOffset: {
                width: number;
                height: number;
            };
            shadowOpacity: number;
            shadowRadius: number;
            elevation: number;
        };
        lg: {
            shadowColor: string;
            shadowOffset: {
                width: number;
                height: number;
            };
            shadowOpacity: number;
            shadowRadius: number;
            elevation: number;
        };
    };
    layout: {
        headerHeight: number;
        containerPadding: number;
        cardPadding: number;
    };
    zIndex: {
        dropdown: number;
        modal: number;
        tooltip: number;
    };
    colors: {
        primary: {
            main: string;
            light: string;
            dark: string;
            hover: string;
        };
        secondary: {
            main: string;
            light: string;
            dark: string;
        };
        background: {
            default: string;
            paper: string;
            secondary: string;
        };
        text: {
            primary: string;
            secondary: string;
            disabled: string;
            inverse: string;
        };
        border: {
            default: string;
            light: string;
            dark: string;
        };
        status: {
            success: {
                bg: string;
                text: string;
            };
            error: {
                bg: string;
                text: string;
            };
            warning: {
                bg: string;
                text: string;
            };
            info: {
                bg: string;
                text: string;
            };
        };
    };
    spacing: {
        xs: number;
        sm: number;
        md: number;
        lg: number;
        xl: number;
        xxl: number;
    };
};
