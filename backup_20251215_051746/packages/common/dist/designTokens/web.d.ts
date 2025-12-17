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
export declare const WebDesignTokens: {
    typography: {
        h1: {
            fontSize: number;
            fontWeight: number;
            lineHeight: number;
        };
        h2: {
            fontSize: number;
            fontWeight: number;
            lineHeight: number;
        };
        h3: {
            fontSize: number;
            fontWeight: number;
            lineHeight: number;
        };
        h4: {
            fontSize: number;
            fontWeight: number;
            lineHeight: number;
        };
        body: {
            fontSize: number;
            fontWeight: number;
            lineHeight: number;
        };
        bodyMedium: {
            fontSize: number;
            fontWeight: number;
            lineHeight: number;
        };
        bodySmall: {
            fontSize: number;
            fontWeight: number;
            lineHeight: number;
        };
        caption: {
            fontSize: number;
            fontWeight: number;
            lineHeight: number;
        };
    };
    shadows: {
        sm: string;
        md: string;
        lg: string;
    };
    layout: {
        headerHeight: number;
        containerMaxWidth: number;
        sidebarWidth: number;
    };
    heights: {
        card: number;
        titleInput: number;
        contentInput: number;
        buttonSmall: number;
        buttonDefault: number;
    };
    buttonPadding: {
        small: {
            horizontal: number;
            vertical: number;
        };
        default: {
            horizontal: number;
            vertical: number;
        };
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
    borderRadius: {
        sm: number;
        md: number;
        lg: number;
        xl: number;
        full: number;
    };
    zIndex: {
        dropdown: number;
        modal: number;
        header: number;
        tooltip: number;
    };
};
export declare const TailwindClassMap: {
    colors: {
        primary: string;
        secondary: string;
        text: {
            primary: string;
            secondary: string;
        };
    };
    spacing: {
        xs: string;
        sm: string;
        md: string;
        lg: string;
    };
};
