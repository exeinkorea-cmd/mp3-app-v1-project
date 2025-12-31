/**
 * [Future Architecture] 통신 음영 지역 대응 네트워크 인터페이스
 * LTE/5G 불가 지역에서 유선 확장 Wi-Fi 및 P2P 메쉬 통신을 지원하기 위한 설계
 */

// 1. 통신 연결 상태 정의
export type NetworkMode = 
  | 'CELLULAR_5G_LTE'    // 일반적인 통신 상태
  | 'SITE_WIFI_EXTENDER' // 지하 현장 유선 확장 공유기 접속 상태
  | 'OFFLINE_MESH_P2P'   // 통신 완전 두절 시 기기 간 직접 연결 상태
  | 'DISCONNECTED';      // 고립 위험 상태

// 2. 현장 와이파이 정보 (위치 추적 겸용)
export interface SiteWifiInfo {
  ssid: string;          // 예: "Haimil_Site_B1_Zone3"
  bssid: string;         // 공유기 MAC 주소 (고유 식별자)
  signalStrength: number;// RSSI (신호 세기)
  installedZoneId: string; // 예: "Underground-B2-A" (서버에 등록된 구역 ID)
  isOfficialAp: boolean; // 현장에 공식 설치된 공유기인지 검증
}

// 3. 네트워크 상태 관리자 인터페이스
export interface NetworkManager {
  currentMode: NetworkMode;
  
  // 셀룰러 신호 상실 시 와이파이 모드로 자동 전환
  switchToSiteWifi(): Promise<boolean>;
  
  // 모든 통신 두절 시 주변 기기 스캔 (메쉬 네트워크 진입)
  activateMeshBeacon(): void;
  
  // 공유기 접속 정보로 현재 대략적 위치 추정 (지하 층수 등)
  estimateLocationByWifi(wifiInfo: SiteWifiInfo): Promise<string>;
}

