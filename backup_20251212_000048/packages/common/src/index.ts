// F:\mp3-app\mp3-app-v1-project\packages\common\src\index.ts

// 이 타입은 이제 web-cms, mobiles, functions가 모두 함께 쓸 거예요!
export type UserRole = "User" | "TM" | "CMS";

export const GREETING = "Hello from @mp3/common!";

// [성공!] '중앙 발전소' 전기 수출 라인(export * from './firebase';)이
// 이 파일에서 완전히 제거되었습니다.

// 디자인 토큰 export
export * from "./designTokens";

// 공통 타입 export
export * from "./types";