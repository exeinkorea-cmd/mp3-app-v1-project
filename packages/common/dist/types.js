"use strict";
/**
 * 공통 타입 정의
 * 모든 패키지에서 공유하는 기본 타입들을 정의합니다.
 *
 * 플랫폼별 특화 필드는 각 패키지에서 확장하여 사용하세요.
 *
 * ⚠️ React 타입 사용 시 주의사항:
 * - mobiles 패키지: react@19.1.0 사용
 * - web-cms 패키지: react@19.2.0 사용
 * - React 타입을 사용할 경우, 두 버전 모두와 호환되는 타입을 사용하거나
 *   각 패키지에서 별도로 타입을 확장하여 사용하세요.
 * - 예: React.ComponentProps, React.FC 등은 버전 간 차이가 있을 수 있습니다.
 */
Object.defineProperty(exports, "__esModule", { value: true });
// ⚠️ 향후 React 컴포넌트 Props 타입을 추가할 경우:
// - React.ComponentProps<'div'> 대신 일반 객체 타입 사용 권장
// - 또는 각 패키지에서 React 타입을 import하여 확장
// 예시:
// export interface BaseComponentProps {
//   // React 타입에 의존하지 않는 순수 타입 정의
// }
//# sourceMappingURL=types.js.map