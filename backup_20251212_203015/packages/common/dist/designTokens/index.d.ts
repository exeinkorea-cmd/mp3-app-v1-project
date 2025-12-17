/**
 * 공통 디자인 토큰 (Base Design Tokens)
 * 모든 플랫폼(웹, 모바일)에서 공유하는 기본 디자인 값들을 정의합니다.
 *
 * 플랫폼별 특화 토큰은 web.ts, mobile.ts를 참조하세요.
 */
export declare const BaseDesignTokens: {
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
