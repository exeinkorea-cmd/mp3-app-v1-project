/**
 * 공통 타입 정의
 * 모든 패키지에서 공유하는 기본 타입들을 정의합니다.
 * 
 * 플랫폼별 특화 필드는 각 패키지에서 확장하여 사용하세요.
 */

// 소속(부서) 기본 타입
export interface BaseDepartment {
  id: string;
  name: string;
  type: 'company' | 'team';
  parentId?: string; // 팀의 경우 소속 업체 ID (필수)
}


