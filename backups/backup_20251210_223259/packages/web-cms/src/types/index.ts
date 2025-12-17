import { Timestamp } from "firebase/firestore";
import { User } from "firebase/auth";
import { BaseDepartment } from "@mp3/common";

// Firestore 문서 타입
export interface Department extends BaseDepartment {
  createdAt: Timestamp;
}

export interface Bulletin {
  id: string;
  title: string;
  originalText: string;
  titleTranslations?: Record<string, string>;
  contentTranslations?: Record<string, string>;
  authorEmail: string;
  department?: string; // 하위 호환성을 위해 유지
  targetType: "all" | "company" | "team";
  targetValue: string | null;
  isPersistent: boolean;
  expiryDate?: Timestamp;
  createdAt: Timestamp;
  status: string;
}

export interface AuthCheckIn {
  id: string;
  userName?: string;
  phoneNumber?: string;
  department?: string;
  timestamp?: Timestamp;
  highRiskWork?: string;
  highRiskWorkUpdatedAt?: Timestamp;
  noticeConfirmed?: boolean;
  checkOutTime?: Timestamp; // 퇴근시간
  location?: {
    latitude: number;
    longitude: number;
  };
}

// 컴포넌트 Props 타입
export interface SignInFormProps {
  // 현재는 props가 없지만, 향후 확장 가능
}

export interface BulletinDashboardProps {
  user: User;
}

export interface AttendanceListProps {
  // 현재는 props가 없지만, 향후 확장 가능
}

export interface DashboardHeaderProps {
  user: User;
  onLogout: () => Promise<void>;
  onManualReset?: () => Promise<void>;
  isResetting?: boolean;
  onRevokeSessions?: () => Promise<void>;
  isRevoking?: boolean;
}

// 번역 함수 응답 타입
export interface TranslateResponse {
  data: {
    translatedObject: Record<string, string>;
  };
}

// 드롭다운 관련 타입
export interface DepartmentPickerProps {
  departments: string[];
  selectedDepartment: string;
  onSelect: (department: string) => void;
  isOpen: boolean;
  onToggle: () => void;
}

// 긴급 알림 타입
export interface EmergencyAlert {
  id: string;
  type: "fire" | "suggestion";
  userId: string;
  userName?: string;
  department?: string;
  timestamp: Timestamp;
  message: string;
  translations?: Record<string, string>;
}

// 소속 추가 요청 타입
export interface TeamRequest {
  id: string;
  requesterName: string;
  requestedTeamName: string;
  phoneNumber: string;
  status: "pending" | "approved" | "rejected";
  timestamp: Timestamp;
  approvedAt?: Timestamp;
  rejectedAt?: Timestamp;
}

// 현장 상태 로그 타입
export interface SiteStatusLog {
  id: string;
  checkTime: string;
  timestamp: Timestamp;
  status: "active" | "inactive";
  activeUsersCount: number;
  activeUsers: string[];
  message: string;
}

// 퇴근 확인 알림 타입
export interface CheckoutPrompt {
  id: string;
  userId: string;
  userName: string;
  timestamp: Timestamp;
  message: string;
  status: "pending" | "confirmed" | "dismissed";
  checkTime: string;
  confirmedAt?: Timestamp;
  dismissedAt?: Timestamp;
}


