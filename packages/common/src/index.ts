// F:\mp3-app\mp3-app-v1-project\packages\common\src\index.ts

// 이 타입은 이제 web-cms, mobiles, functions가 모두 함께 쓸 거예요!

// ⚠️ React 타입 export 시 주의사항:
// - 이 파일에서 React 타입을 직접 export하지 마세요
// - 각 패키지(mobiles, web-cms)에서 필요한 React 타입은
//   해당 패키지에서 직접 import하여 사용하세요
// - 이유: mobiles는 react@19.1.0, web-cms는 react@19.2.0을 사용하므로
//   공통 패키지에서 React 타입을 export하면 버전 충돌이 발생할 수 있습니다

export type UserRole = "User" | "TM" | "CMS";

export const GREETING = "Hello from @mp3/common!";

// [성공!] '중앙 발전소' 전기 수출 라인(export * from './firebase';)이
// 이 파일에서 완전히 제거되었습니다.

// 디자인 토큰 export
export * from "./designTokens";

// 공통 타입 export
export * from "./types";