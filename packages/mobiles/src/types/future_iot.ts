/**
 * [Future Architecture] IoT 확장 인터페이스 설계
 * 향후 BLE Beacon 및 Wi-Fi Fingerprinting을 통한 실내 측위 및
 * 통신 음영 지역(Dead Zone)에서의 P2P 안전 통신을 위한 데이터 구조입니다.
 */

// 1. 하이브리드 위치 정보 구조체 (GPS + Beacon + WiFi)
export interface HybridLocation {
  type: 'gps' | 'beacon' | 'wifi_rtt';
  latitude?: number;    // 실외용
  longitude?: number;   // 실외용
  floorLevel?: number;  // 지하/실내 층수 (IoT 센서로 판별)
  accuracy: number;     // 정확도
  deadZoneMode: boolean; // 통신 두절 지역 여부
}

// 2. IoT 센서 신호 정의
export interface IotSensorSignal {
  deviceId: string;     // 비콘 UUID 또는 와이파이 MAC
  signalStrength: number; // RSSI (신호 세기 -> 거리 계산용)
  batteryLevel: number;
  isEmergencyBeacon: boolean; // 위험 기계(지게차 등) 부착 센서 여부
}

// 3. 오프라인 메쉬 통신 (통신 단절 시 폰끼리 신호 전달)
export interface OfflineSafetyMessage {
  senderId: string;
  messageType: 'SOS' | 'EVACUATE';
  timestamp: number;
  ttl: number; // Time To Live (메시지 생존 시간)
}

