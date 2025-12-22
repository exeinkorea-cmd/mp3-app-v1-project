import React, { useState, useEffect } from "react";
import {
  StyleSheet,
  Text,
  View,
  FlatList,
  SafeAreaView,
  TextInput,
  Button,
  Alert,
  TouchableOpacity,
  Image,
  Platform,
  ActionSheetIOS,
  ScrollView,
  ActivityIndicator,
  Linking,
  Modal,
} from "react-native";

import { auth, db, functions } from "./firebase";
import {
  signInWithEmailAndPassword,
  signInAnonymously,
  onAuthStateChanged,
  onIdTokenChanged,
  User,
  signOut,
} from "firebase/auth";
import {
  collection,
  query,
  onSnapshot,
  orderBy,
  Timestamp,
  addDoc,
  serverTimestamp,
  where,
  getDocs,
  updateDoc,
  doc,
  deleteField,
  getDoc,
  arrayUnion,
  arrayRemove,
} from "firebase/firestore";
import { httpsCallable } from "firebase/functions";

import { GREETING, UserRole, BaseDepartment, MobileDesignTokens } from "@mp3/common";
import * as Location from "expo-location";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { NativeModules } from "react-native";

interface Bulletin {
  id: string;
  title?: string;
  originalText: string;
  titleTranslations?: Record<string, string>;
  contentTranslations?: Record<string, string>;
  createdAt: Timestamp;
  targetType?: "all" | "company" | "team";
  targetValue?: string | null;
  targetValues?: string[] | null; // 여러 대상 선택 시 사용
}

interface MobileUser {
  name: string;
  phoneNumber: string;
  companyId: string;
  companyName: string;
  teamId: string;
  teamName: string;
}

const STORAGE_KEY = "@mobile_user";
const CHECKED_BULLETINS_KEY = "@checked_bulletins";
const REMEMBERED_INPUTS_KEY = "@remembered_user_inputs";

// Haversine 공식으로 두 좌표 간 거리 계산 (미터 단위) - 공유 함수
const calculateDistance = (
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number
): number => {
  const R = 6371000; // 지구 반경 (미터)
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
};

// 금일 주요작업 다국어 제목
const MAJOR_WORK_TITLES = {
  ko: "금일 주요작업",
  en: "Today's Major Work",
  zh: "今日主要工作",
  vi: "Công việc chính hôm nay",
  ru: "Основные работы на сегодня",
};

// 언어 감지 함수 (기기 언어 설정 기반)
const getDeviceLanguage = (): string => {
  try {
    let locale = "";

    // 1. Intl API 사용 (가장 안전한 방법)
    if (typeof Intl !== "undefined" && Intl.DateTimeFormat) {
      const resolved = Intl.DateTimeFormat().resolvedOptions();
      locale = resolved.locale || "";
    }

    // 2. Intl이 없거나 실패한 경우 NativeModules 사용
    if (!locale) {
      if (Platform.OS === "ios") {
        // iOS
        const SettingsManager = NativeModules.SettingsManager;
        locale =
          SettingsManager?.settings?.AppleLocale ||
          SettingsManager?.settings?.AppleLanguages?.[0] ||
          "";
      } else {
        // Android
        const I18nManager = NativeModules.I18nManager;
        locale = I18nManager?.localeIdentifier || "";
      }
    }

    // locale을 언어 코드로 변환 (예: "ko-KR" -> "ko", "en-US" -> "en", "zh-CN" -> "zh")
    const langCode = locale.split("-")[0].toLowerCase();

    // 지원하는 언어인지 확인
    if (langCode in MAJOR_WORK_TITLES) {
      return langCode;
    }

    // 지원하지 않는 언어는 기본값(한국어) 반환
    return "ko";
  } catch (error) {
    console.error("언어 감지 오류:", error);
    return "ko"; // 기본값
  }
};

function SignInForm() {
  const [name, setName] = useState("");
  const [phoneNumber, setPhoneNumber] = useState("");
  const [departments, setDepartments] = useState<BaseDepartment[]>([]);
  const [selectedCompanyId, setSelectedCompanyId] = useState<string>("");
  const [selectedTeamId, setSelectedTeamId] = useState<string>("");
  const [selectedCompanyName, setSelectedCompanyName] = useState<string>("");
  const [selectedTeamName, setSelectedTeamName] = useState<string>("");
  const [isCompanyDropdownOpen, setIsCompanyDropdownOpen] = useState(false);
  const [isTeamDropdownOpen, setIsTeamDropdownOpen] = useState(false);
  const [isPrivacyAgreed, setIsPrivacyAgreed] = useState(false);
  const [isLoggingIn, setIsLoggingIn] = useState(false); // 로그인 진행 중 상태
  const [isPolicyVisible, setIsPolicyVisible] = useState(false); // 개인정보처리방침 팝업 상태

  // 개인정보처리방침 내용 (privacyPolicy.txt에서 가져온 내용)
  // GPS 수집을 통한 안전 관리 및 일일 데이터 리셋 정책 포함
  const PRIVACY_POLICY_TEXT = `# 개인정보처리방침

**1. 총칙**
본 애플리케이션(이하 "앱")은 건설 현장의 안전 관리와 효율적인 인력 운영을 위해 제작되었습니다. 회사는 사용자의 개인정보를 중요시하며, '개인정보 보호법' 등 관련 법령을 준수하고 있습니다.

**2. 개인정보의 수집 및 이용 목적**
앱은 다음의 목적을 위해 필수적인 최소한의 개인정보를 처리합니다.

* **현장 안전 관리 및 공지 전달:** 사용자의 현재 위치한 건설 현장에 맞는 안전 수칙, 위험 구역 경고, 긴급 대피 알림 등을 실시간으로 제공하기 위함입니다.
* **긴급 상황 대응 (GPS 수집 강조):**
    1.  사용자가 작업 중인 현장의 위치를 확인하여 정확한 출퇴근 처리를 돕습니다.
    2.  **특히, 미리 정해진 작업 계획이 없음에도 퇴근 시간 이후 현장에 머무르는 경우, 사고 발생 여부 확인 및 신속한 긴급 구조 요청 등 사용자의 안전을 확보하기 위해 위치 정보(GPS)를 수집 및 이용합니다.**
* **소속 및 신원 확인:** 현장 출입 권한 확인 및 팀 배정을 위함입니다.

**3. 수집하는 개인정보의 항목**
* 필수항목: 이름, 전화번호, 소속(업체명/팀명), 기기 고유 식별 정보
* 선택항목: 위치 정보 (GPS 좌표) - *단, 현장 내 출퇴근 처리 및 안전 기능을 위해 필수적임*

**4. 개인정보의 보유 및 파기 (일일 리셋 정책)**
건설 현장의 특성상 매일 새로운 작업과 인력 배치가 이루어지므로, 본 앱은 원칙적으로 **수집된 일일 출퇴근 기록, 현장 상태 로그, 긴급 알림 내역 등의 데이터를 매일 파기(Reset)**합니다.

단, 다음의 정보는 예외적으로 보존됩니다.
* 지속적인 공지사항 확인 이력 (장기 공지 제외)
* 사용자 계정 기본 정보 (소속, 이름 등) 및 설정값

**5. 동의 거부 권리**
사용자는 개인정보 수집 및 이용에 거부할 권리가 있습니다. 다만, 필수 항목(특히 위치 정보)에 대한 동의를 거부할 경우, 앱을 통한 현장 출입 인증 및 안전 관련 주요 기능 사용이 제한될 수 있습니다.`;

  // 핸드폰 번호 자동 포맷팅 함수
  const formatPhoneNumber = (text: string): string => {
    // 숫자만 추출
    const numbers = text.replace(/[^0-9]/g, "");

    // 숫자가 없으면 빈 문자열 반환
    if (numbers.length === 0) return "";

    // 길이에 따라 하이픈 추가
    if (numbers.length <= 3) {
      return numbers;
    } else if (numbers.length <= 6) {
      // 4~6자리: 3-나머지
      return `${numbers.slice(0, 3)}-${numbers.slice(3)}`;
    } else if (numbers.length <= 10) {
      // 7~10자리: 3-3-나머지 (10자리: 3-3-4)
      return `${numbers.slice(0, 3)}-${numbers.slice(3, 6)}-${numbers.slice(
        6,
        10
      )}`;
    } else {
      // 11자리 이상: 3-4-4
      return `${numbers.slice(0, 3)}-${numbers.slice(3, 7)}-${numbers.slice(
        7,
        11
      )}`;
    }
  };

  // 핸드폰 번호 변경 핸들러
  const handlePhoneNumberChange = (text: string) => {
    const formatted = formatPhoneNumber(text);
    setPhoneNumber(formatted);
  };

  // Firestore에서 departments 데이터 로드
  useEffect(() => {
    const unsubscribe = onSnapshot(
      collection(db, "departments"),
      (snapshot) => {
        const depts: BaseDepartment[] = [];
        snapshot.forEach((doc) => {
          depts.push({ id: doc.id, ...doc.data() } as BaseDepartment);
        });
        setDepartments(depts);
      },
      (error) => {
        console.error("소속 데이터 로드 오류:", error);
      }
    );
    return () => unsubscribe();
  }, []);

  // 저장된 입력 정보 불러오기 (컴포넌트 마운트 시)
  useEffect(() => {
    const loadRememberedInputs = async () => {
      try {
        // 먼저 @remembered_user_inputs에서 불러오기 (우선순위)
        const rememberedInputs = await AsyncStorage.getItem(
          REMEMBERED_INPUTS_KEY
        );
        if (rememberedInputs) {
          const inputs = JSON.parse(rememberedInputs);
          setName(inputs.name || "");
          setPhoneNumber(inputs.phoneNumber || "");
          setSelectedCompanyId(inputs.companyId || "");
          setSelectedTeamId(inputs.teamId || "");
          setSelectedCompanyName(inputs.companyName || "");
          setSelectedTeamName(inputs.teamName || "");
          return; // 저장된 입력 정보가 있으면 여기서 종료
        }

        // @remembered_user_inputs가 없으면 @mobile_user에서 불러오기 (하위 호환성)
        const stored = await AsyncStorage.getItem(STORAGE_KEY);
        if (stored) {
          const lastUser: MobileUser = JSON.parse(stored);
          setName(lastUser.name);
          setPhoneNumber(lastUser.phoneNumber);
          // 회사/팀 정보는 departments가 로드된 후에 복원
          setSelectedCompanyId(lastUser.companyId);
          setSelectedTeamId(lastUser.teamId);
          setSelectedCompanyName(lastUser.companyName);
          setSelectedTeamName(lastUser.teamName);
        }
      } catch (error) {
        console.error("저장된 입력 정보 불러오기 오류:", error);
      }
    };

    loadRememberedInputs();
  }, []);

  // departments가 로드된 후 회사/팀 이름 복원
  useEffect(() => {
    if (departments.length > 0 && selectedCompanyId) {
      // 회사 이름 확인
      const company = departments.find(
        (dept) => dept.id === selectedCompanyId && dept.type === "company"
      );
      if (company && company.name !== selectedCompanyName) {
        setSelectedCompanyName(company.name);
      }

      // 팀 이름 확인
      if (selectedTeamId) {
        const team = departments.find(
          (dept) => dept.id === selectedTeamId && dept.type === "team"
        );
        if (team && team.name !== selectedTeamName) {
          setSelectedTeamName(team.name);
        }
      }
    }
  }, [departments, selectedCompanyId, selectedTeamId]);

  // 회사 목록 필터링
  const companies = departments
    .filter((dept) => dept.type === "company")
    .sort((a, b) => a.name.localeCompare(b.name));

  // "기타" 옵션 추가
  const companiesWithOther = [
    ...companies,
    { id: "other", name: "기타", type: "company" as const },
  ];

  // 선택된 회사에 소속된 팀 목록
  const teamsInCompany = departments
    .filter(
      (dept) => dept.type === "team" && dept.parentId === selectedCompanyId
    )
    .sort((a, b) => a.name.localeCompare(b.name));

  // 회사 선택 핸들러
  const handleCompanySelect = () => {
    if (companiesWithOther.length === 0) {
      Alert.alert("알림", "등록된 회사가 없습니다.");
      return;
    }
    setIsCompanyDropdownOpen(!isCompanyDropdownOpen);
    setIsTeamDropdownOpen(false);
  };

  // 회사 선택 함수
  const selectCompany = (companyId: string, companyName: string) => {
    setSelectedCompanyId(companyId);
    setSelectedCompanyName(companyName);
    setSelectedTeamId("");
    setSelectedTeamName("");
    setIsCompanyDropdownOpen(false);
  };

  // 팀 선택 핸들러
  const handleTeamSelect = () => {
    if (!selectedCompanyId) {
      Alert.alert("알림", "먼저 회사를 선택해주세요.");
      return;
    }

    if (teamsInCompany.length === 0) {
      Alert.alert("알림", "해당 회사에 소속된 팀이 없습니다.");
      return;
    }
    setIsTeamDropdownOpen(!isTeamDropdownOpen);
  };

  // 팀 선택 함수
  const selectTeam = (teamId: string, teamName: string) => {
    setSelectedTeamId(teamId);
    setSelectedTeamName(teamName);
    setIsTeamDropdownOpen(false);
  };

  const handleLogin = async () => {
    // 1. 입력 검증
    if (!name.trim()) {
      Alert.alert("알림", "이름을 입력해주세요.");
      return;
    }
    if (!phoneNumber.trim()) {
      Alert.alert("알림", "핸드폰번호를 입력해주세요.");
      return;
    }
    if (!selectedCompanyId) {
      Alert.alert("알림", "소속 회사를 선택해주세요.");
      return;
    }
    // "기타" 선택 시 팀 선택 검증 건너뛰기
    if (selectedCompanyId !== "other" && !selectedTeamId) {
      Alert.alert("알림", "소속 팀을 선택해주세요.");
      return;
    }
    if (!isPrivacyAgreed) {
      Alert.alert("알림", "개인정보처리방침 및 이용약관에 동의해주세요.");
      return;
    }

    // 로그인 시작 - 로딩 상태 활성화
    setIsLoggingIn(true);

    try {
      // 2. GPS 권한 요청 (동기적 처리)
      const { status: locationStatus } =
        await Location.requestForegroundPermissionsAsync();

      if (locationStatus !== "granted") {
        Alert.alert("권한 거부됨", "로그인을 위해 GPS 위치 권한이 필요합니다.");
        setIsLoggingIn(false);
        return;
      }

      // 3. GPS 위치 확인 (동기적 처리)
      const location = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.Balanced,
      });
      const { latitude, longitude } = location.coords;

      // 4. Firestore에서 현장 설정 가져오기
      let siteConfig: {
        center: { latitude: number; longitude: number };
        allowedRadiusMeters: number;
      };
      try {
        const configDoc = await getDoc(doc(db, "settings", "site_config"));
        if (!configDoc.exists()) {
          // 설정이 없으면 기본값 사용
          siteConfig = {
            center: { latitude: 37.536111, longitude: 126.833333 },
            allowedRadiusMeters: 500,
          };
        } else {
          siteConfig = configDoc.data() as {
            center: { latitude: number; longitude: number };
            allowedRadiusMeters: number;
          };
        }
      } catch (error) {
        console.error("설정 불러오기 오류:", error);
        Alert.alert("오류", "현장 설정을 불러올 수 없습니다.");
        setIsLoggingIn(false);
        return;
      }

      // 5. 현장 반경 체크 (Haversine Formula) - 범위 밖이면 로그인 차단
      const distance = calculateDistance(
        siteConfig.center.latitude,
        siteConfig.center.longitude,
        latitude,
        longitude
      );

      if (distance > siteConfig.allowedRadiusMeters) {
        Alert.alert(
          "위치 오류",
          "GS 아테라자이 현장 안에서 로그인을 재시도 해주세요. 만약 현장 안에 있다면 관리자에게 연락해주세요. (02-2154-9717)"
        );
        setIsLoggingIn(false);
        return; // 로그인 즉시 차단
      }

      // 5. 커스텀 사용자 정보 저장
      const mobileUser: MobileUser = {
        name,
        phoneNumber,
        companyId: selectedCompanyId,
        companyName:
          selectedCompanyId === "other" ? "기타" : selectedCompanyName,
        teamId: selectedCompanyId === "other" ? "" : selectedTeamId,
        teamName: selectedCompanyId === "other" ? "" : selectedTeamName,
      };
      await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(mobileUser));

      // 6. Firebase Auth 익명 로그인 (먼저 인증)
      await signInAnonymously(auth);

      // 7. "기타" 선택 시 teamRequests에 요청 추가 (인증 후)
      if (selectedCompanyId === "other") {
        await addDoc(collection(db, "teamRequests"), {
          requesterName: name,
          requestedTeamName: "기타",
          phoneNumber: phoneNumber,
          status: "pending",
          timestamp: serverTimestamp(),
        });
      }

      // 8. 기기 언어 설정 감지
      const deviceLang = getDeviceLanguage();
      const highRiskWorkTitle =
        MAJOR_WORK_TITLES[deviceLang as keyof typeof MAJOR_WORK_TITLES] ||
        MAJOR_WORK_TITLES.ko;

      // 9. 출석 체크 데이터를 authCheckIns 컬렉션에 저장
      await addDoc(collection(db, "authCheckIns"), {
        phoneNumber: phoneNumber, // 사용자 식별용 (필수)
        userName: name, // 표시용
        department:
          selectedCompanyId === "other"
            ? "기타"
            : `${selectedCompanyName} - ${selectedTeamName}`, // 협력사 카운트용
        timestamp: serverTimestamp(), // 시간 정렬 및 최신 판단용 (필수)
        location: { latitude, longitude }, // 위치 정보
        highRiskWork: highRiskWorkTitle, // 고위험작업 제목 (기기 언어 설정 기반)
        // checkOutTime은 저장하지 않음 (없으면 현재 로그인 상태로 인식됨)
      });

      // 10. 입력 정보를 별도 키에 저장 (재로그인 시 자동 채우기용)
      const rememberedInputs = {
        name,
        phoneNumber,
        companyId: selectedCompanyId,
        companyName:
          selectedCompanyId === "other" ? "기타" : selectedCompanyName,
        teamId: selectedCompanyId === "other" ? "" : selectedTeamId,
        teamName: selectedCompanyId === "other" ? "" : selectedTeamName,
      };
      await AsyncStorage.setItem(
        REMEMBERED_INPUTS_KEY,
        JSON.stringify(rememberedInputs)
      );

      Alert.alert("로그인 성공!", `환영합니다, ${name}님!`);
    } catch (error) {
      Alert.alert(
        "로그인 실패!",
        error instanceof Error
          ? error.message
          : "알 수 없는 오류가 발생했습니다."
      );
    } finally {
      // 로그인 완료/실패 후 로딩 상태 해제
      setIsLoggingIn(false);
    }
  };

  return (
    <View style={styles.container}>
      <Image
        source={require("../assets/logo.png")}
        style={styles.logo}
        resizeMode="contain"
      />
      <Text style={styles.title}>GS건설 아테라자이 현장</Text>
      <TextInput
        style={styles.input}
        placeholder="이름"
        value={name}
        onChangeText={setName}
      />
      <TextInput
        style={styles.input}
        placeholder="핸드폰번호"
        value={phoneNumber}
        onChangeText={handlePhoneNumberChange}
        keyboardType="phone-pad"
        maxLength={13}
      />

      {/* 소속 선택 */}
      <View style={styles.departmentContainer}>
        <View style={styles.departmentDropdownContainer}>
          <TouchableOpacity
            style={styles.departmentButton}
            onPress={handleCompanySelect}
          >
            <Text style={styles.departmentButtonText}>
              {selectedCompanyName || "회사 선택"}
            </Text>
          </TouchableOpacity>
          {isCompanyDropdownOpen && companiesWithOther.length > 0 && (
            <View style={styles.departmentDropdownMenu}>
              <ScrollView style={{ maxHeight: 150 }} nestedScrollEnabled={true}>
                {companiesWithOther.map((company) => (
                  <TouchableOpacity
                    key={company.id}
                    style={[
                      styles.departmentDropdownOption,
                      selectedCompanyId === company.id &&
                        styles.departmentDropdownOptionSelected,
                    ]}
                    onPress={() => selectCompany(company.id, company.name)}
                  >
                    <Text
                      style={[
                        styles.departmentDropdownOptionText,
                        selectedCompanyId === company.id &&
                          styles.departmentDropdownOptionTextSelected,
                      ]}
                    >
                      {company.name}
                    </Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>
            </View>
          )}
        </View>

        {/* "기타"가 아닌 경우에만 팀 선택 표시 */}
        {selectedCompanyId && selectedCompanyId !== "other" && (
          <View style={styles.departmentDropdownContainer}>
            <TouchableOpacity
              style={[styles.departmentButton, styles.departmentButtonTeam]}
              onPress={handleTeamSelect}
            >
              <Text style={styles.departmentButtonText}>
                {selectedTeamName || "팀 선택"}
              </Text>
            </TouchableOpacity>
            {isTeamDropdownOpen && teamsInCompany.length > 0 && (
              <View style={styles.departmentDropdownMenu}>
                <ScrollView
                  style={{ maxHeight: 150 }}
                  nestedScrollEnabled={true}
                >
                  {teamsInCompany.map((team) => (
                    <TouchableOpacity
                      key={team.id}
                      style={[
                        styles.departmentDropdownOption,
                        selectedTeamId === team.id &&
                          styles.departmentDropdownOptionSelected,
                      ]}
                      onPress={() => selectTeam(team.id, team.name)}
                    >
                      <Text
                        style={[
                          styles.departmentDropdownOptionText,
                          selectedTeamId === team.id &&
                            styles.departmentDropdownOptionTextSelected,
                        ]}
                      >
                        {team.name}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </ScrollView>
              </View>
            )}
          </View>
        )}
      </View>

      {/* 개인정보 동의 체크박스 */}
      <View style={styles.privacyContainer}>
        <TouchableOpacity
          style={styles.checkboxContainer}
          onPress={() => setIsPrivacyAgreed(!isPrivacyAgreed)}
        >
          <View
            style={[
              styles.privacyCheckbox,
              isPrivacyAgreed && styles.privacyCheckboxChecked,
            ]}
          >
            {isPrivacyAgreed && (
              <Text style={styles.privacyCheckboxCheckmark}>✓</Text>
            )}
          </View>
          <View style={styles.privacyTextContainer}>
          <Text style={styles.privacyText}>
              개인정보처리방침 및 이용약관에 동의합니다
          </Text>
            <TouchableOpacity
              onPress={() => setIsPolicyVisible(true)}
              activeOpacity={0.7}
            >
              <Text style={styles.privacyLinkText}>개인정보처리방침</Text>
            </TouchableOpacity>
          </View>
        </TouchableOpacity>
      </View>

      {/* 개인정보처리방침 팝업 Modal */}
      <Modal
        visible={isPolicyVisible}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setIsPolicyVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContainer}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>개인정보처리방침</Text>
      <TouchableOpacity
                onPress={() => setIsPolicyVisible(false)}
                style={styles.modalCloseButton}
              >
                <Text style={styles.modalCloseButtonText}>닫기</Text>
              </TouchableOpacity>
            </View>
            <ScrollView
              style={styles.modalContent}
              contentContainerStyle={styles.modalContentContainer}
              showsVerticalScrollIndicator={true}
            >
              <Text style={styles.modalText}>{PRIVACY_POLICY_TEXT}</Text>
            </ScrollView>
          </View>
        </View>
      </Modal>

      <TouchableOpacity
        style={[styles.loginButton, isLoggingIn && styles.loginButtonDisabled]}
        onPress={handleLogin}
        activeOpacity={0.7}
        disabled={isLoggingIn}
      >
        {isLoggingIn ? (
          <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
            <ActivityIndicator size="small" color="#FFFFFF" />
            <Text style={styles.loginButtonText}>위치 확인 중...</Text>
          </View>
        ) : (
        <Text style={styles.loginButtonText}>출근하기</Text>
        )}
      </TouchableOpacity>
    </View>
  );
}

function BulletinList({
  user,
  mobileUser,
}: {
  user: User;
  mobileUser: MobileUser | null;
}) {
  const [bulletins, setBulletins] = useState<Bulletin[]>([]);
  const [selectedLanguage, setSelectedLanguage] = useState("한국어");
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const [checkedBulletins, setCheckedBulletins] = useState<Set<string>>(
    new Set()
  );
  // 기본 공지사항 체크 상태 추가
  const [checkedDefaultBulletins, setCheckedDefaultBulletins] = useState<
    Set<string>
  >(new Set());

  // 기본 공지사항 데이터
  const defaultBulletins = [
    {
      id: "default_1",
      text: "금일 업체별 주요 고위험작업을 확인하였습니다.\n금일 팀별 주요작업 (TBM) 을 확인하였습니다.\nGS 필수 안전수칙을 확인하였습니다.",
    },
  ];

  // 언어 코드 매핑
  const languageMap: Record<string, string> = {
    한국어: "ko",
    중국어: "zh",
    베트남어: "vi",
    러시아어: "ru",
  };

  // 언어 표시 텍스트 매핑
  const languageDisplayNames: Record<string, string> = {
    한국어: "한국어",
    중국어: "中文",
    베트남어: "Tiếng Việt",
    러시아어: "Русский",
  };

  // "현재 공지가 없습니다." 다국어 텍스트
  const noBulletinText: Record<string, string> = {
    한국어: "현재 공지가 없습니다.",
    중국어: "目前没有公告。",
    베트남어: "Hiện tại không có thông báo.",
    러시아어: "В настоящее время нет объявлений.",
  };

  // "위 내용을 확인하였습니다." 다국어 텍스트
  const confirmationText: Record<string, string> = {
    한국어: "위 내용을 확인하였습니다.",
    중국어: "我已确认上述内容。",
    베트남어: "Tôi đã xác nhận nội dung trên.",
    러시아어: "Я подтвердил вышеуказанное содержание.",
  };

  // 알림 메시지 다국어 텍스트
  const ALERT_MESSAGES = {
    fire: {
      ko: "화재 신고를 진행하시겠습니까?",
      en: "Do you want to report a fire?",
      zh: "您要申报火灾吗？",
      vi: "Bạn có muốn báo cháy không?",
      ru: "Вы хотите сообщить о пожаре?",
    },
    happyCall: {
      ko: "해피콜 접수를 진행하시겠습니까?",
      en: "Do you want to request a Happy Call?",
      zh: "您要申请Happy Call吗？",
      vi: "Bạn có muốn yêu cầu Happy Call không?",
      ru: "Вы хотите запросить Happy Call?",
    },
  };

  // 언어 코드를 ALERT_MESSAGES 키로 변환하는 함수
  const getAlertLanguageCode = (): keyof typeof ALERT_MESSAGES.fire => {
    const langCode = languageMap[selectedLanguage];
    // languageMap의 값(ko, zh, vi, ru)을 그대로 사용
    return (langCode || "ko") as keyof typeof ALERT_MESSAGES.fire;
  };

  // 공지 필터링 함수
  const shouldShowBulletin = (
    bulletin: Bulletin,
    user: MobileUser | null
  ): boolean => {
    // 사용자 정보가 없으면 모든 공지 표시 (로그인 전)
    if (!user) return true;

    // targetType이 없으면 모든 사용자에게 표시 (하위 호환성)
    if (!bulletin.targetType || bulletin.targetType === "all") {
      return true;
    }

    // targetValues 배열이 있는 경우 (여러 대상 선택)
    if (bulletin.targetValues && bulletin.targetValues.length > 0) {
      if (bulletin.targetType === "company") {
        return bulletin.targetValues.includes(user.companyId);
      }
      if (bulletin.targetType === "team") {
        return bulletin.targetValues.includes(user.teamId);
      }
    }

    // targetValue가 있는 경우 (단일 대상 선택)
    if (bulletin.targetValue) {
      if (bulletin.targetType === "company") {
        return bulletin.targetValue === user.companyId;
      }
      if (bulletin.targetType === "team") {
        return bulletin.targetValue === user.teamId;
      }
    }

    return false;
  };

  useEffect(() => {
    const q = query(collection(db, "bulletins"), orderBy("createdAt", "desc"));
    const unsubscribe = onSnapshot(q, (querySnapshot) => {
      const docs: Bulletin[] = [];
      querySnapshot.forEach((doc) => {
        const data = { id: doc.id, ...doc.data() } as Bulletin;

        // 공지 필터링 로직
        if (shouldShowBulletin(data, mobileUser)) {
          docs.push(data);
        }
      });
      setBulletins(docs);
    });
    return () => unsubscribe();
  }, [mobileUser]);

  // 체크 상태 로드 (컴포넌트 마운트 시) - 기본 공지사항 체크 상태도 로드
  useEffect(() => {
    const loadCheckedBulletins = async () => {
      if (!mobileUser?.phoneNumber) return;

      try {
        const key = `${CHECKED_BULLETINS_KEY}_${mobileUser.phoneNumber}`;
        const stored = await AsyncStorage.getItem(key);
        if (stored) {
          const checkedIds = JSON.parse(stored) as string[];
          setCheckedBulletins(new Set(checkedIds));
        }

        // 기본 공지사항 체크 상태 로드
        const defaultKey = `${CHECKED_BULLETINS_KEY}_default_${mobileUser.phoneNumber}`;
        const defaultStored = await AsyncStorage.getItem(defaultKey);
        if (defaultStored) {
          const defaultCheckedIds = JSON.parse(defaultStored) as string[];
          setCheckedDefaultBulletins(new Set(defaultCheckedIds));
        }
      } catch (error) {
        console.error("체크 상태 로드 오류:", error);
      }
    };

    loadCheckedBulletins();
  }, [mobileUser?.phoneNumber]);

  // 선택한 언어에 맞는 텍스트 가져오기
  const getDisplayText = (item: Bulletin): string => {
    const langCode = languageMap[selectedLanguage];

    if (selectedLanguage === "한국어") {
      return item.originalText;
    }

    // contentTranslations에서 해당 언어 텍스트 가져오기
    if (item.contentTranslations && item.contentTranslations[langCode]) {
      return item.contentTranslations[langCode];
    }

    // 번역이 없으면 원문 표시
    return item.originalText;
  };

  // 선택한 언어에 맞는 제목 가져오기
  const getDisplayTitle = (item: Bulletin): string => {
    const langCode = languageMap[selectedLanguage];

    if (selectedLanguage === "한국어") {
      return item.title || "";
    }

    // titleTranslations에서 해당 언어 제목 가져오기
    if (item.titleTranslations && item.titleTranslations[langCode]) {
      return item.titleTranslations[langCode];
    }

    // 번역이 없으면 원문 제목 표시
    return item.title || "";
  };

  // 버튼 텍스트 번역 함수
  const getButtonText = (buttonType: "fire" | "request" | "logout"): string => {
    const translations: Record<string, Record<string, string>> = {
      fire: {
        한국어: "화재",
        중국어: "火灾",
        베트남어: "Hỏa hoạn",
        러시아어: "Пожар",
      },
      request: {
        한국어: "요청",
        중국어: "请求",
        베트남어: "Yêu cầu",
        러시아어: "Запрос",
      },
      logout: {
        한국어: "퇴근",
        중국어: "登出",
        베트남어: "Đăng xuất",
        러시아어: "Выход",
      },
    };
    return (
      translations[buttonType][selectedLanguage] ||
      translations[buttonType]["한국어"]
    );
  };

  // 언어 목록
  const languages = ["한국어", "중국어", "베트남어", "러시아어"];

  // 언어 선택 핸들러
  const handleLanguageSelect = () => {
    setIsDropdownOpen(!isDropdownOpen);
  };

  // 언어 선택 함수
  const selectLanguage = (language: string) => {
    setSelectedLanguage(language);
    setIsDropdownOpen(false);
  };

  // 체크박스 토글 함수
  const toggleCheckbox = async (bulletinId: string) => {
    // 이미 체크된 경우 체크 해제 불가능
    if (checkedBulletins.has(bulletinId)) {
      return;
    }

    try {
      // GPS 권한 확인
      const { status: locationStatus } =
        await Location.requestForegroundPermissionsAsync();

      if (locationStatus !== "granted") {
        Alert.alert(
          "권한 필요",
          "공지사항 확인을 위해 GPS 위치 권한이 필요합니다."
        );
        return;
      }

      // 현재 위치 가져오기
      const location = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.Balanced,
      });
      const { latitude, longitude } = location.coords;

      // Firestore에서 현장 설정 가져오기
      let siteConfig: {
        center: { latitude: number; longitude: number };
        allowedRadiusMeters: number;
      };
      try {
        const configDoc = await getDoc(doc(db, "settings", "site_config"));
        if (!configDoc.exists()) {
          siteConfig = {
            center: { latitude: 37.536111, longitude: 126.833333 },
            allowedRadiusMeters: 500,
          };
        } else {
          siteConfig = configDoc.data() as {
            center: { latitude: number; longitude: number };
            allowedRadiusMeters: number;
          };
        }
      } catch (error) {
        console.error("설정 불러오기 오류:", error);
        Alert.alert("오류", "현장 설정을 불러올 수 없습니다.");
        return;
      }

      // 현장 반경 체크 (Haversine Formula)
      const distance = calculateDistance(
        siteConfig.center.latitude,
        siteConfig.center.longitude,
        latitude,
        longitude
      );

      if (distance > siteConfig.allowedRadiusMeters) {
        Alert.alert(
          "위치 오류",
          `설정된 현장 반경(${siteConfig.allowedRadiusMeters}m)을 벗어났습니다.\n` +
            `현재 거리: ${Math.round(distance)}m\n` +
            `현재 위치: (${latitude.toFixed(4)}, ${longitude.toFixed(4)})`
        );
        return;
      }

      // 범위 안에 있으면 체크 상태 업데이트
      const newSet = new Set(checkedBulletins);
      newSet.add(bulletinId);
      setCheckedBulletins(newSet);

      // AsyncStorage에 저장 및 authCheckIns의 noticeHistory 업데이트 (또는 하위 호환성을 위해 noticeConfirmed)
      if (mobileUser?.phoneNumber) {
        try {
          const key = `${CHECKED_BULLETINS_KEY}_${mobileUser.phoneNumber}`;
          await AsyncStorage.setItem(key, JSON.stringify(Array.from(newSet)));

          // authCheckIns의 noticeHistory 업데이트
          const checkInsQuery = query(
            collection(db, "authCheckIns"),
            where("phoneNumber", "==", mobileUser.phoneNumber),
            orderBy("timestamp", "desc")
          );
          const querySnapshot = await getDocs(checkInsQuery);

          // checkOutTime이 없는 최신 레코드 찾아서 업데이트
          for (const docSnapshot of querySnapshot.docs) {
            const data = docSnapshot.data();
            if (!data.checkOutTime) {
              const noticeHistory = data.noticeHistory || [];
              const noticeIndex = noticeHistory.findIndex(
                (n: any) => n.id === bulletinId
              );

              if (noticeIndex >= 0) {
                // noticeHistory에 해당 공지가 있으면 업데이트
                const existingNotice = noticeHistory[noticeIndex];
                const updatedNotice = {
                  ...existingNotice,
                  confirmed: true,
                };

                // 기존 항목 제거 후 업데이트된 항목 추가
                await updateDoc(doc(db, "authCheckIns", docSnapshot.id), {
                  noticeHistory: arrayRemove(existingNotice),
                });
                await updateDoc(doc(db, "authCheckIns", docSnapshot.id), {
                  noticeHistory: arrayUnion(updatedNotice),
                });
              } else {
                // noticeHistory에 없는 경우 (하위 호환성: 기존 noticeConfirmed 사용)
                await updateDoc(doc(db, "authCheckIns", docSnapshot.id), {
                  noticeConfirmed: true,
                });
              }
              break; // 첫 번째 레코드만 업데이트
            }
          }
        } catch (error) {
          console.error("체크 상태 저장 오류:", error);
        }
      }
    } catch (error) {
      console.error("GPS 확인 오류:", error);
      Alert.alert("오류", "위치 정보를 가져오는 중 오류가 발생했습니다.");
    }
  };

  // 기본 공지사항 체크박스 토글 함수
  const toggleDefaultCheckbox = async (bulletinId: string) => {
    // 이미 체크된 경우 체크 해제 불가능
    if (checkedDefaultBulletins.has(bulletinId)) {
      return;
    }

    try {
      // GPS 권한 확인
      const { status: locationStatus } =
        await Location.requestForegroundPermissionsAsync();

      if (locationStatus !== "granted") {
        Alert.alert(
          "권한 필요",
          "공지사항 확인을 위해 GPS 위치 권한이 필요합니다."
        );
        return;
      }

      // 현재 위치 가져오기
      const location = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.Balanced,
      });
      const { latitude, longitude } = location.coords;

      // Firestore에서 현장 설정 가져오기
      let siteConfig: {
        center: { latitude: number; longitude: number };
        allowedRadiusMeters: number;
      };
      try {
        const configDoc = await getDoc(doc(db, "settings", "site_config"));
        if (!configDoc.exists()) {
          siteConfig = {
            center: { latitude: 37.536111, longitude: 126.833333 },
            allowedRadiusMeters: 500,
          };
        } else {
          siteConfig = configDoc.data() as {
            center: { latitude: number; longitude: number };
            allowedRadiusMeters: number;
          };
        }
      } catch (error) {
        console.error("설정 불러오기 오류:", error);
        Alert.alert("오류", "현장 설정을 불러올 수 없습니다.");
        return;
      }

      // 현장 반경 체크 (Haversine Formula)
      const distance = calculateDistance(
        siteConfig.center.latitude,
        siteConfig.center.longitude,
        latitude,
        longitude
      );

      if (distance > siteConfig.allowedRadiusMeters) {
        Alert.alert(
          "위치 오류",
          `설정된 현장 반경(${siteConfig.allowedRadiusMeters}m)을 벗어났습니다.\n` +
            `현재 거리: ${Math.round(distance)}m\n` +
            `현재 위치: (${latitude.toFixed(4)}, ${longitude.toFixed(4)})`
        );
        return;
      }

      // 범위 안에 있으면 체크 상태 업데이트
      const newSet = new Set(checkedDefaultBulletins);
      newSet.add(bulletinId);
      setCheckedDefaultBulletins(newSet);

      // AsyncStorage에 저장 및 authCheckIns의 noticeHistory 업데이트 (또는 하위 호환성을 위해 noticeConfirmed)
      if (mobileUser?.phoneNumber) {
        try {
          const key = `${CHECKED_BULLETINS_KEY}_default_${mobileUser.phoneNumber}`;
          await AsyncStorage.setItem(key, JSON.stringify(Array.from(newSet)));

          // authCheckIns의 noticeHistory 업데이트
          const checkInsQuery = query(
            collection(db, "authCheckIns"),
            where("phoneNumber", "==", mobileUser.phoneNumber),
            orderBy("timestamp", "desc")
          );
          const querySnapshot = await getDocs(checkInsQuery);

          // checkOutTime이 없는 최신 레코드 찾아서 업데이트
          for (const docSnapshot of querySnapshot.docs) {
            const data = docSnapshot.data();
            if (!data.checkOutTime) {
              const noticeHistory = data.noticeHistory || [];
              const noticeIndex = noticeHistory.findIndex(
                (n: any) => n.id === bulletinId
              );

              if (noticeIndex >= 0) {
                // noticeHistory에 해당 공지가 있으면 업데이트
                const existingNotice = noticeHistory[noticeIndex];
                const updatedNotice = {
                  ...existingNotice,
                  confirmed: true,
                };

                // 기존 항목 제거 후 업데이트된 항목 추가
                await updateDoc(doc(db, "authCheckIns", docSnapshot.id), {
                  noticeHistory: arrayRemove(existingNotice),
                });
                await updateDoc(doc(db, "authCheckIns", docSnapshot.id), {
                  noticeHistory: arrayUnion(updatedNotice),
                });
              } else {
                // noticeHistory에 없는 경우 (하위 호환성: 기존 noticeConfirmed 사용)
                await updateDoc(doc(db, "authCheckIns", docSnapshot.id), {
                  noticeConfirmed: true,
                });
              }
              break; // 첫 번째 레코드만 업데이트
            }
          }
        } catch (error) {
          console.error("체크 상태 저장 오류:", error);
        }
      }
    } catch (error) {
      console.error("GPS 확인 오류:", error);
      Alert.alert("오류", "위치 정보를 가져오는 중 오류가 발생했습니다.");
    }
  };

  // 화재 버튼 핸들러
  const handleFireEmergency = async () => {
    if (!mobileUser) {
      Alert.alert("오류", "로그인이 필요합니다.");
      return;
    }

    const langCode = getAlertLanguageCode();
    const confirmMessage = ALERT_MESSAGES.fire[langCode];

    Alert.alert(getButtonText("fire"), confirmMessage, [
      { text: "취소", style: "cancel" },
      {
        text: "신고",
        onPress: async () => {
          try {
            // 1. 전화 연결
            await Linking.openURL("tel:119");

            // 2. Firestore에 긴급 알림 문서 생성
            const department = mobileUser.teamName
              ? `${mobileUser.companyName} - ${mobileUser.teamName}`
              : mobileUser.companyName;
            await addDoc(collection(db, "emergencyAlerts"), {
              type: "fire",
              userName: mobileUser.name || "알 수 없음",
              department: department || "알 수 없음",
              phoneNumber: mobileUser.phoneNumber || "",
              timestamp: serverTimestamp(),
            });

            Alert.alert("신고 완료", "화재 신고가 접수되었습니다.");
          } catch (error) {
            console.error("화재 신고 오류:", error);
            Alert.alert("오류", "화재 신고 처리 중 오류가 발생했습니다.");
          }
        },
      },
    ]);
  };

  // 요청 버튼 핸들러
  const handleRequest = async () => {
    if (!mobileUser) {
      Alert.alert("오류", "로그인이 필요합니다.");
      return;
    }

    const langCode = getAlertLanguageCode();
    const confirmMessage = ALERT_MESSAGES.happyCall[langCode];

    Alert.alert(getButtonText("request"), confirmMessage, [
      { text: "취소", style: "cancel" },
      {
        text: "접수",
        onPress: async () => {
          try {
            // 1. 전화 연결
            await Linking.openURL("tel:02-2154-9717");

            // 2. Firestore에 해피콜 요청 문서 생성
            const department = mobileUser.teamName
              ? `${mobileUser.companyName} - ${mobileUser.teamName}`
              : mobileUser.companyName;
            await addDoc(collection(db, "emergencyAlerts"), {
              type: "happy_call",
              userName: mobileUser.name || "알 수 없음",
              department: department || "알 수 없음",
              phoneNumber: mobileUser.phoneNumber || "",
              timestamp: serverTimestamp(),
            });

            Alert.alert("접수 완료", "해피콜 요청이 접수되었습니다.");
          } catch (error) {
            console.error("해피콜 요청 오류:", error);
            Alert.alert("오류", "해피콜 요청 처리 중 오류가 발생했습니다.");
          }
        },
      },
    ]);
  };

  // 로그아웃 핸들러 (서버 함수 사용)
  const handleLogout = () => {
    Alert.alert("로그아웃", "로그아웃 하시겠습니까?", [
      { text: "취소", style: "cancel" },
      {
        text: "로그아웃",
        onPress: async () => {
          try {
            // 1. 서버 함수 호출하여 퇴근 처리
            if (mobileUser?.phoneNumber) {
              const revokeUserSession = httpsCallable(
                functions,
                "revokeUserSession"
              );
              const result = await revokeUserSession({
                phoneNumber: mobileUser.phoneNumber,
              });

              const data = result.data as {
                success: boolean;
                message: string;
                updatedCount?: number;
              };

              if (!data.success) {
                console.error("퇴근 처리 실패:", data.message);
              }
            }

            // 2. 로그아웃
            await signOut(auth);
          } catch (error) {
            console.error("퇴근 처리 오류:", error);
            // 오류가 발생해도 로그아웃은 진행
            await signOut(auth);
          }
        },
      },
    ]);
  };

  return (
    <View style={styles.bulletinListContainer}>
      {/* 버전 문구 추가 - 최상단 우측 */}
      <View style={styles.versionContainer}>
        <Text 
          style={styles.versionText}
          includeFontPadding={false}
          textAlignVertical="center"
        >
          안전공지 알리미 V1.0
        </Text>
      </View>

      {/* 헤더 버튼 4개 */}
      <View style={styles.headerButtons}>
        <View style={styles.dropdownContainer}>
          <TouchableOpacity
            style={styles.dropdownButton}
            onPress={handleLanguageSelect}
          >
            <Text
              style={styles.dropdownButtonText}
              numberOfLines={1}
              adjustsFontSizeToFit={true}
              minimumFontScale={0.7}
            >
              {languageDisplayNames[selectedLanguage]}
            </Text>
          </TouchableOpacity>
          {isDropdownOpen && (
            <View style={styles.dropdownMenu}>
              {languages.map((lang) => (
                <TouchableOpacity
                  key={lang}
                  style={[
                    styles.dropdownOption,
                    selectedLanguage === lang && styles.dropdownOptionSelected,
                  ]}
                  onPress={() => selectLanguage(lang)}
                >
                  <Text
                    style={[
                      styles.dropdownOptionText,
                      selectedLanguage === lang &&
                        styles.dropdownOptionTextSelected,
                    ]}
                  >
                    {languageDisplayNames[lang]}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          )}
        </View>

        <TouchableOpacity
          style={styles.headerButtonRed}
          onPress={handleFireEmergency}
        >
          <Text style={styles.headerButtonTextWhite}>
            {getButtonText("fire")}
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.headerButtonYellow}
          onPress={handleRequest}
        >
          <Text style={styles.headerButtonTextBlack}>
            {getButtonText("request")}
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.headerButtonWhite}
          onPress={handleLogout}
        >
          <Text style={styles.headerButtonTextBlack}>
            {getButtonText("logout")}
          </Text>
        </TouchableOpacity>
      </View>

      <Text style={styles.title}>금일 고위험작업 안전수칙</Text>

      {/* 기본 공지사항 표시 기능 주석처리 - 공지사항이 없을 때 기본 공지사항을 표시하지 않음 */}
      {bulletins.length > 0 ? (
        <FlatList
          data={bulletins}
          keyExtractor={(item) => item.id}
          renderItem={({ item }) => {
            const displayTitle = getDisplayTitle(item);
            const displayText = getDisplayText(item);

            return (
              <View style={styles.bulletinItem}>
                {displayTitle ? (
                  <Text style={styles.bulletinTitle}>{displayTitle}</Text>
                ) : null}
                <Text style={styles.bulletinText}>{displayText}</Text>

                {/* 내용과 확인 섹션 사이 구분선 */}
                <View style={styles.bulletinDivider} />

                {/* 확인 섹션 */}
                <View style={styles.bulletinConfirmation}>
                  <Text style={styles.bulletinConfirmationText}>
                    {confirmationText[selectedLanguage] || confirmationText["한국어"]}
                  </Text>
                  <TouchableOpacity
                    style={[
                      styles.checkbox,
                      checkedBulletins.has(item.id) && styles.checkboxDisabled,
                    ]}
                    onPress={() => toggleCheckbox(item.id)}
                    disabled={checkedBulletins.has(item.id)}
                  >
                    {checkedBulletins.has(item.id) ? (
                      <View style={styles.checkboxChecked}>
                        <Text style={styles.checkboxCheckmark}>✓</Text>
                      </View>
                    ) : (
                      <View style={styles.checkboxUnchecked} />
                    )}
                  </TouchableOpacity>
                </View>
              </View>
            );
          }}
        />
      ) : (
        <View style={styles.emptyBulletinContainer}>
          <View style={styles.emptyBulletinCard}>
            <Text style={styles.emptyBulletinText}>
              {noBulletinText[selectedLanguage] || noBulletinText["한국어"]}
            </Text>
          </View>
        </View>
      )}
    </View>
  );
}

export default function App() {
  const [user, setUser] = useState<User | null>(null);
  const [mobileUser, setMobileUser] = useState<MobileUser | null>(null);

  useEffect(() => {
    // Firebase Auth 상태 확인
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      setUser(firebaseUser);

      // 로그인된 경우 AsyncStorage에서 사용자 정보 복원
      if (firebaseUser) {
        try {
          const stored = await AsyncStorage.getItem(STORAGE_KEY);
          if (stored) {
            setMobileUser(JSON.parse(stored));
          }
        } catch (error) {
          console.error("사용자 정보 복원 오류:", error);
        }
      } else {
        setMobileUser(null);
      }
    });
    return () => unsubscribe();
  }, []);

  // 토큰 상태 감시 - 즉시 로그아웃 감지
  useEffect(() => {
    const unsubscribe = onIdTokenChanged(auth, async (firebaseUser) => {
      if (!firebaseUser) {
        // 로그아웃 감지됨 -> 로그인 화면으로 이동
        console.log("로그아웃 되었습니다.");
        setMobileUser(null);
        try {
          // 인증 관련 데이터만 삭제 (세션 정보)
          // @remembered_user_inputs는 유지하여 재로그인 시 입력 필드 자동 채우기
          await AsyncStorage.removeItem(STORAGE_KEY);
        } catch (error) {
          console.error("AsyncStorage 삭제 오류:", error);
        }
      } else {
        // 토큰이 유효한지 강제로 한 번 체크 (서버에서 revoked 됐는지 확인)
        try {
          await firebaseUser.getIdToken(true); // true = 강제 갱신 요청
        } catch (error) {
          // 토큰 갱신 실패 (서버에서 차단됨) -> 강제 로그아웃 처리
          console.log("세션 만료됨:", error);
          try {
            await signOut(auth);
            // 인증 관련 데이터만 삭제 (세션 정보)
            // @remembered_user_inputs는 유지하여 재로그인 시 입력 필드 자동 채우기
            await AsyncStorage.removeItem(STORAGE_KEY);
            Alert.alert("로그아웃", "관리자에 의해 로그아웃 처리되었습니다.");
          } catch (signOutError) {
            console.error("강제 로그아웃 오류:", signOutError);
          }
        }
      }
    });
    return () => unsubscribe();
  }, []);

  // authCheckIns 실시간 감시 - checkOutTime이 설정되거나 문서가 삭제되면 자동 로그아웃
  useEffect(() => {
    if (!mobileUser?.phoneNumber) return;

    const checkInsQuery = query(
      collection(db, "authCheckIns"),
      where("phoneNumber", "==", mobileUser.phoneNumber),
      orderBy("timestamp", "desc")
    );

    let isInitialLoad = true; // 초기 로드 플래그
    const previousCheckOutTimes = new Map<string, any>(); // 이전 checkOutTime 상태 저장
    const previousDocIds = new Set<string>(); // 이전 문서 ID 저장 (삭제 감지용)

    const unsubscribe = onSnapshot(checkInsQuery, (querySnapshot) => {
      // 초기 로드 시에는 이전 상태만 저장하고 처리하지 않음
      if (isInitialLoad) {
        querySnapshot.docs.forEach((doc) => {
          const data = doc.data();
          previousCheckOutTimes.set(doc.id, data.checkOutTime || null);
          previousDocIds.add(doc.id);
        });
        isInitialLoad = false;
        return;
      }

      // 변경사항 감지
      querySnapshot.docChanges().forEach((change) => {
        if (change.type === "removed") {
          // 문서가 삭제된 경우 (강제 로그아웃)
          console.log("출석 문서가 삭제되었습니다. 로그아웃 처리합니다.");
          signOut(auth)
            .then(() => {
              // 인증 관련 데이터만 삭제 (세션 정보)
              // @remembered_user_inputs는 유지하여 재로그인 시 입력 필드 자동 채우기
              return AsyncStorage.removeItem(STORAGE_KEY);
            })
            .then(() => {
              Alert.alert("로그아웃", "관리자에 의해 로그아웃 처리되었습니다.");
            })
            .catch((error) => {
              console.error("자동 로그아웃 오류:", error);
            });
          return; // 삭제된 문서는 더 이상 처리하지 않음
        }

        if (change.type === "modified") {
          const data = change.doc.data();
          const docId = change.doc.id;
          const previousCheckOutTime = previousCheckOutTimes.get(docId);
          const currentCheckOutTime = data.checkOutTime || null;

          // checkOutTime이 이전에는 없었고, 지금은 있는 경우에만 로그아웃
          if (!previousCheckOutTime && currentCheckOutTime) {
            // Alert 없이 즉시 로그아웃
            signOut(auth)
              .then(() => {
                // 인증 관련 데이터만 삭제 (세션 정보)
                // @remembered_user_inputs는 유지하여 재로그인 시 입력 필드 자동 채우기
                return AsyncStorage.removeItem(STORAGE_KEY);
              })
              .then(() => {
                Alert.alert(
                  "로그아웃",
                  "관리자에 의해 로그아웃 처리되었습니다."
                );
              })
              .catch((error) => {
                console.error("자동 로그아웃 오류:", error);
              });
          }

          // 이전 상태 업데이트
          previousCheckOutTimes.set(docId, currentCheckOutTime);
        } else if (change.type === "added") {
          // 새 문서가 추가된 경우에도 이전 상태 저장
          const data = change.doc.data();
          previousCheckOutTimes.set(change.doc.id, data.checkOutTime || null);
          previousDocIds.add(change.doc.id);
        }
      });

      // 현재 존재하는 문서 ID 업데이트 (삭제 감지를 위해)
      const currentDocIds = new Set<string>();
      querySnapshot.docs.forEach((doc) => {
        currentDocIds.add(doc.id);
      });

      // 이전에 존재했지만 지금은 없는 문서 감지 (방어 코드)
      previousDocIds.forEach((docId) => {
        if (!currentDocIds.has(docId)) {
          console.log(
            "출석 문서가 삭제되었습니다 (방어 코드). 로그아웃 처리합니다."
          );
          signOut(auth)
            .then(() => {
              // 인증 관련 데이터만 삭제 (세션 정보)
              // @remembered_user_inputs는 유지하여 재로그인 시 입력 필드 자동 채우기
              return AsyncStorage.removeItem(STORAGE_KEY);
            })
            .then(() => {
              Alert.alert("로그아웃", "관리자에 의해 로그아웃 처리되었습니다.");
            })
            .catch((error) => {
              console.error("자동 로그아웃 오류:", error);
            });
        }
      });

      // previousDocIds 업데이트
      previousDocIds.clear();
      currentDocIds.forEach((id) => previousDocIds.add(id));
    });

    return () => unsubscribe();
  }, [mobileUser?.phoneNumber]);

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.container}>
        {user && mobileUser ? (
          <>
            <View style={styles.welcomeContainer}>
              {/* 헤더 텍스트 삭제, 여백만 유지 */}
            </View>
            <BulletinList user={user} mobileUser={mobileUser} />
          </>
        ) : (
          <SignInForm />
        )}
      </View>
      
      {/* 저작권 문구 - 로그인 화면일 때만 하단에 표시 */}
      {!user || !mobileUser ? (
        <View style={styles.copyrightContainer}>
          <Text 
            style={styles.copyrightText}
            includeFontPadding={false}
            textAlignVertical="center"
          >
            Copyright © 2025 엑스인 세이프티. All rights reserved.
          </Text>
        </View>
      ) : null}
      
      {/* 바텀 영역 - 메인페이지에서만 보이도록 */}
      {user && mobileUser && (
        <View style={styles.bottomContainer}>
          <Image
            source={require("../assets/logo.png")}
            style={styles.bottomLogo}
            resizeMode="contain"
          />
          <Text style={styles.bottomText}>아테라자이 현장</Text>
        </View>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: "#fff",
  },
  container: {
    flex: 1,
    backgroundColor: "#fff",
    alignItems: "center",
    justifyContent: "center",
    padding: 10,
    width: "100%",
  },
  logo: {
    width: 200,
    height: 80,
    marginBottom: 30,
  },
  title: {
    fontSize: 24,
    fontWeight: "bold",
    marginBottom: 20,
    textAlign: "center",
  },
  subtitle: {
    fontSize: 16,
    color: "gray",
    marginBottom: 10,
  },
  welcomeContainer: {
    paddingTop: 0,
    marginBottom: 10,
    alignItems: "center",
  },
  welcomeText: {
    fontSize: 18,
    fontWeight: "bold",
    color: "#333",
  },
  input: {
    width: "90%",
    height: 40,
    borderColor: "gray",
    borderWidth: 1,
    marginBottom: 10,
    padding: 10,
  },
  loginButton: {
    width: "90%",
    height: 44,
    borderColor: "transparent",
    borderWidth: 0,
    marginBottom: 10,
    padding: 10,
    backgroundColor: Platform.OS === "ios" ? "#007AFF" : "#2196F3",
    borderRadius: Platform.OS === "ios" ? 8 : 4,
    justifyContent: "center",
    alignItems: "center",
  },
  loginButtonDisabled: {
    opacity: 0.6,
  },
  loginButtonText: {
    fontSize: 16,
    color: "#FFFFFF",
    fontWeight: "600",
  },
  departmentContainer: {
    width: "90%",
    marginBottom: 10,
  },
  departmentButton: {
    width: "100%",
    height: 44,
    borderColor: "gray",
    borderWidth: 1,
    marginBottom: 0,
    paddingVertical: 10,
    paddingHorizontal: 10,
    justifyContent: "center",
    backgroundColor: "#f9f9f9",
    borderRadius: 4,
  },
  departmentButtonTeam: {
    marginTop: 0,
  },
  departmentButtonText: {
    fontSize: 16,
    color: "#333",
  },
  departmentDropdownContainer: {
    width: "100%",
    position: "relative",
    marginBottom: 10,
  },
  departmentDropdownMenu: {
    position: "absolute",
    top: 44,
    left: 0,
    right: 0,
    backgroundColor: "#fff",
    borderRadius: 4,
    borderWidth: 1,
    borderColor: "#ddd",
    zIndex: 1000,
    elevation: 5,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
  },
  departmentDropdownOption: {
    paddingVertical: 12,
    paddingHorizontal: 15,
    borderBottomWidth: 1,
    borderBottomColor: "#f0f0f0",
  },
  departmentDropdownOptionSelected: {
    backgroundColor: "#f5f5f5",
  },
  departmentDropdownOptionText: {
    fontSize: 16,
    color: "#333",
  },
  departmentDropdownOptionTextSelected: {
    fontWeight: "600",
    color: "#333",
  },
  bulletinListContainer: {
    flex: 1,
    width: "95%",
  },
  bulletinItem: {
    backgroundColor: "#fff",
    padding: 15,
    marginVertical: 5,
    borderRadius: 5,
    width: "100%",
    borderWidth: 1,
    borderColor: "#e0e0e0",
    minHeight: 120, // 최소 높이 추가 (3줄 텍스트를 위한 여유 공간)
  },
  bulletinTitle: {
    fontSize: 18,
    fontWeight: "bold",
    marginBottom: 8,
    color: "#030213",
    paddingBottom: 8,
    borderBottomWidth: 1,
    borderBottomColor: "#e0e0e0",
  },
  bulletinText: {
    fontSize: 16,
    fontWeight: "400",
    color: "#111827",
    lineHeight: 24, // 줄 간격 추가 (폰트 크기의 1.5배 정도)
  },
  bulletinDivider: {
    borderTopWidth: 1,
    borderTopColor: "#e0e0e0",
    marginTop: 12,
    marginBottom: 12,
  },
  bulletinConfirmation: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  bulletinConfirmationText: {
    fontSize: 16,
    fontWeight: "bold",
    color: "#111827",
  },
  checkbox: {
    width: 24,
    height: 24,
    justifyContent: "center",
    alignItems: "center",
  },
  checkboxUnchecked: {
    width: 24,
    height: 24,
    borderWidth: 2,
    borderColor: "#333",
    borderRadius: 4,
  },
  checkboxChecked: {
    width: 24,
    height: 24,
    backgroundColor: "#007AFF",
    borderWidth: 2,
    borderColor: "#007AFF",
    borderRadius: 4,
    justifyContent: "center",
    alignItems: "center",
  },
  checkboxCheckmark: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "bold",
  },
  checkboxDisabled: {
    opacity: 0.6,
  },
  // 헤더 버튼 스타일
  headerButtons: {
    flexDirection: "row",
    justifyContent: "space-between",
    width: "100%",
    marginBottom: 20,
    paddingHorizontal: 5,
  },
  headerButtonWhite: {
    flex: 0.98,
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: "#DDD",
    borderRadius: 5,
    height: 44,
    paddingVertical: 0,
    paddingHorizontal: 8,
    marginHorizontal: 2,
    alignItems: "center",
    justifyContent: "center",
  },
  headerButtonRed: {
    flex: 0.98,
    backgroundColor: "#FF0000",
    borderWidth: 1,
    borderColor: "#CC0000",
    borderRadius: 5,
    height: 44,
    paddingVertical: 0,
    paddingHorizontal: 8,
    marginHorizontal: 2,
    alignItems: "center",
    justifyContent: "center",
  },
  headerButtonYellow: {
    flex: 0.98,
    backgroundColor: "#FFD600",
    borderWidth: 1,
    borderColor: "#E6C200",
    borderRadius: 5,
    height: 44,
    paddingVertical: 0,
    paddingHorizontal: 8,
    marginHorizontal: 2,
    alignItems: "center",
    justifyContent: "center",
  },
  headerButtonTextBlack: {
    fontSize: 14,
    color: "#000000",
    fontWeight: "500",
  },
  headerButtonTextWhite: {
    fontSize: 14,
    color: "#FFFFFF",
    fontWeight: "500",
  },
  dropdownContainer: {
    flex: 1.15,
    position: "relative",
    marginHorizontal: 2,
  },
  dropdownButton: {
    width: "100%",
    backgroundColor: Platform.OS === "ios" ? "#007AFF" : "#2196F3",
    borderWidth: 0,
    borderColor: "transparent",
    borderRadius: Platform.OS === "ios" ? 8 : 4,
    height: 44,
    paddingVertical: 0,
    paddingHorizontal: 8,
    alignItems: "center",
    justifyContent: "center",
  },
  dropdownButtonText: {
    fontSize: 14,
    color: "#FFFFFF",
    fontWeight: "500",
  },
  dropdownMenu: {
    position: "absolute",
    top: 44,
    left: 0,
    right: 0,
    backgroundColor: "#fff",
    borderRadius: 5,
    borderWidth: 1,
    borderColor: "#DDD",
    zIndex: 1000,
    elevation: 5,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
  },
  dropdownOption: {
    paddingVertical: 12,
    paddingHorizontal: 15,
    borderBottomWidth: 1,
    borderBottomColor: "#f0f0f0",
  },
  dropdownOptionSelected: {
    backgroundColor: "#f5f5f5",
  },
  dropdownOptionText: {
    fontSize: 14,
    color: "#333",
  },
  dropdownOptionTextSelected: {
    fontWeight: "600",
    color: "#007AFF",
  },
  emptyBulletinContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    paddingVertical: 40,
  },
  emptyBulletinCard: {
    backgroundColor: "#fff",
    padding: 15,
    marginVertical: 5,
    borderRadius: 5,
    width: "100%",
    borderWidth: 1,
    borderColor: "#e0e0e0",
    justifyContent: "center",
    alignItems: "center",
    minHeight: 100,
  },
  emptyBulletinText: {
    fontSize: 16,
    color: "gray",
    textAlign: "center",
  },
  privacyContainer: {
    width: "90%",
    marginBottom: 10,
    marginTop: 10,
  },
  checkboxContainer: {
    flexDirection: "row",
    alignItems: "center",
  },
  privacyCheckbox: {
    width: 20,
    height: 20,
    borderWidth: 2,
    borderColor: "#007AFF",
    borderRadius: 4,
    marginRight: 10,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "#FFFFFF",
  },
  privacyCheckboxChecked: {
    backgroundColor: "#007AFF",
  },
  privacyCheckboxCheckmark: {
    color: "#FFFFFF",
    fontSize: 14,
    fontWeight: "bold",
  },
  privacyText: {
    fontSize: 14,
    color: MobileDesignTokens.colors.text.primary,
  },
  privacyTextContainer: {
    flex: 1,
    flexDirection: "row",
    flexWrap: "wrap",
    alignItems: "center",
  },
  privacyLinkText: {
    fontSize: 14,
    color: MobileDesignTokens.colors.secondary.main,
    textDecorationLine: "underline",
    marginLeft: 4,
  },
  // Modal 스타일
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.5)",
    justifyContent: "center",
    alignItems: "center",
  },
  modalContainer: {
    width: "90%",
    height: "80%",
    maxHeight: 600,
    backgroundColor: MobileDesignTokens.colors.background.default,
    borderRadius: MobileDesignTokens.borderRadius.lg,
    ...MobileDesignTokens.shadows.lg,
    overflow: "hidden",
    flexDirection: "column",
  },
  modalHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    padding: MobileDesignTokens.spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: MobileDesignTokens.colors.border.light,
    backgroundColor: MobileDesignTokens.colors.background.paper,
  },
  modalTitle: {
    ...MobileDesignTokens.typography.h3,
    color: MobileDesignTokens.colors.text.primary,
    fontWeight: "600",
  },
  modalCloseButton: {
    padding: MobileDesignTokens.spacing.xs,
    paddingHorizontal: MobileDesignTokens.spacing.sm,
  },
  modalCloseButtonText: {
    ...MobileDesignTokens.typography.body,
    color: MobileDesignTokens.colors.secondary.main,
    fontWeight: "600",
  },
  modalContent: {
    flex: 1,
  },
  modalContentContainer: {
    padding: MobileDesignTokens.spacing.md,
    paddingBottom: MobileDesignTokens.spacing.xl,
  },
  modalText: {
    ...MobileDesignTokens.typography.body,
    color: MobileDesignTokens.colors.text.primary,
    lineHeight: 24,
    fontSize: 14,
  },
  // 바텀 영역 스타일
  bottomContainer: {
    width: "100%",
    paddingTop: 0,
    paddingBottom: 20,
    paddingHorizontal: 20,
    minHeight: 70,
    alignItems: "center",
    justifyContent: "center",
    borderTopWidth: 1,
    borderTopColor: "#e0e0e0",
    backgroundColor: "#fff",
    flexDirection: "row",
    gap: 8,
  },
  bottomLogo: {
    width: 80,
    height: 32,
    opacity: 0.7,
  },
  bottomText: {
    fontSize: 16, // 조금 더 크게
    color: "#999999", // 더 연한 회색
    fontWeight: "500",
    marginTop: 5, // 로고 중심선에 맞추기 위해 아래로 이동
    lineHeight: 16, // lineHeight를 fontSize와 동일하게 설정하여 수직 정렬 개선
  },
  // 버전 문구 스타일
  versionContainer: {
    width: "100%",
    alignItems: "flex-end", // 우측 정렬
    paddingHorizontal: 5,
    paddingTop: 4, // 상단 여백 추가
    marginBottom: 10,
  },
  versionText: {
    fontSize: 16, // bottomText와 동일
    color: "#999999", // bottomText와 동일
    fontWeight: "500", // bottomText와 동일
    lineHeight: 20, // fontSize보다 크게 설정하여 잘림 방지
  },
  // 저작권 문구 스타일
  copyrightContainer: {
    width: "100%",
    alignItems: "center", // 중앙 정렬
    paddingHorizontal: 10,
    paddingVertical: 10, // 상하 여백
    position: "absolute", // 절대 위치
    bottom: 0, // 화면 하단
    backgroundColor: "#fff", // 배경색
  },
  copyrightText: {
    fontSize: 12, // 한 줄로 보이도록 크기 축소
    color: "#999999",
    fontWeight: "500",
    lineHeight: 16, // fontSize에 맞게 조정
  },
});
