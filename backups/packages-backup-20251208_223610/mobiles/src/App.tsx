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
} from "react-native";

import { auth, db } from "./firebase";
import {
  signInWithEmailAndPassword,
  signInAnonymously,
  onAuthStateChanged,
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
} from "firebase/firestore";

import { GREETING, UserRole, BaseDepartment } from "@mp3/common";
import * as Location from "expo-location";
import AsyncStorage from "@react-native-async-storage/async-storage";

// import { CameraView, useCameraPermissions } from "expo-camera"; // 카메라 기능 비활성화로 주석 처리리
// import * as MediaLibrary from "expo-media-library"; // 이미지 처리 기능 비활성화로 주석 처리리
// import * as ImageManipulator from "expo-image-manipulator"; // 이미지 처리 기능 비활성화로 주석 처리리

interface Bulletin {
  id: string;
  title?: string;
  originalText: string;
  titleTranslations?: Record<string, string>;
  contentTranslations?: Record<string, string>;
  createdAt: Timestamp;
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

  // 대한민국 전체 범위 (테스트용)
  const KOREA_BOUNDS = {
    minLat: 33.0,
    maxLat: 38.6,
    minLng: 124.5,
    maxLng: 132.0,
  };

  // GPS 범위 체크 함수
  const isWithinKorea = (latitude: number, longitude: number): boolean => {
    return (
      latitude >= KOREA_BOUNDS.minLat &&
      latitude <= KOREA_BOUNDS.maxLat &&
      longitude >= KOREA_BOUNDS.minLng &&
      longitude <= KOREA_BOUNDS.maxLng
    );
  };

  // 핸드폰 번호 자동 포맷팅 함수
  const formatPhoneNumber = (text: string): string => {
    // 숫자만 추출
    const numbers = text.replace(/[^0-9]/g, "");

    // 숫자가 없으면 빈 문자열 반환
    if (numbers.length === 0) return "";

    // 길이에 따라 하이픈 추가
    if (numbers.length <= 3) {
      return numbers;
    } else if (numbers.length <= 7) {
      return `${numbers.slice(0, 3)}-${numbers.slice(3)}`;
    } else {
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

  // 마지막 로그인 정보 불러오기 (컴포넌트 마운트 시)
  useEffect(() => {
    const loadLastLoginInfo = async () => {
      try {
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
        console.error("마지막 로그인 정보 불러오기 오류:", error);
      }
    };

    loadLastLoginInfo();
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

  // 선택된 회사에 소속된 팀 목록
  const teamsInCompany = departments
    .filter(
      (dept) => dept.type === "team" && dept.parentId === selectedCompanyId
    )
    .sort((a, b) => a.name.localeCompare(b.name));

  // 회사 선택 핸들러
  const handleCompanySelect = () => {
    if (companies.length === 0) {
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
    if (!selectedTeamId) {
      Alert.alert("알림", "소속 팀을 선택해주세요.");
      return;
    }

    try {
      // 2. GPS 권한 요청
      const { status: locationStatus } =
        await Location.requestForegroundPermissionsAsync();

      if (locationStatus !== "granted") {
        Alert.alert("권한 거부됨", "로그인을 위해 GPS 위치 권한이 필요합니다.");
        return;
      }

      // 3. GPS 위치 확인
      const location = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.Balanced,
      });
      const { latitude, longitude } = location.coords;

      // 4. 대한민국 범위 체크
      if (!isWithinKorea(latitude, longitude)) {
        Alert.alert(
          "위치 오류",
          "대한민국 내에서만 로그인할 수 있습니다.\n" +
            `현재 위치: (${latitude.toFixed(4)}, ${longitude.toFixed(4)})`
        );
        return;
      }

      // 5. 커스텀 사용자 정보 저장
      const mobileUser: MobileUser = {
        name,
        phoneNumber,
        companyId: selectedCompanyId,
        companyName: selectedCompanyName,
        teamId: selectedTeamId,
        teamName: selectedTeamName,
      };
      await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(mobileUser));

      // 6. Firebase Auth 익명 로그인
      await signInAnonymously(auth);

      // 7. 출석 체크 데이터를 authCheckIns 컬렉션에 저장
      await addDoc(collection(db, "authCheckIns"), {
        phoneNumber: phoneNumber, // 사용자 식별용 (필수)
        userName: name, // 표시용
        department: `${selectedCompanyName} - ${selectedTeamName}`, // 협력사 카운트용
        timestamp: serverTimestamp(), // 시간 정렬 및 최신 판단용 (필수)
        location: { latitude, longitude }, // 위치 정보
        // checkOutTime은 저장하지 않음 (없으면 현재 로그인 상태로 인식됨)
      });

      Alert.alert("로그인 성공!", `환영합니다, ${name}님!`);
    } catch (error) {
      Alert.alert(
        "로그인 실패!",
        error instanceof Error
          ? error.message
          : "알 수 없는 오류가 발생했습니다."
      );
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
          {isCompanyDropdownOpen && companies.length > 0 && (
            <View style={styles.departmentDropdownMenu}>
              {companies.map((company) => (
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
            </View>
          )}
        </View>

        {selectedCompanyId && (
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
              </View>
            )}
          </View>
        )}
      </View>

      <TouchableOpacity
        style={styles.loginButton}
        onPress={handleLogin}
        activeOpacity={0.7}
      >
        <Text style={styles.loginButtonText}>출근하기</Text>
      </TouchableOpacity>
    </View>
  );
}

/* 카메라 기능 비활성화로 주석 처리
function LabelingCamera({ user }: { user: User }) {
  const [isCameraOpen, setIsCameraOpen] = useState(false);
  const [capturedPhoto, setCapturedPhoto] = useState<string | null>(null);
  const [labelText, setLabelText] = useState("");
  const [status, setStatus] = useState("아직 촬영 전입니다.");
  const [imageSize, setImageSize] = useState<{
    width: number;
    height: number;
  } | null>(null);
  // const [permission, requestPermission] = useCameraPermissions();
  // const cameraRef = React.useRef<CameraView>(null);

  // 카메라 열기
  // const handleOpenCamera = async () => { ... }

  // 사진 촬영
  // const handleTakePicture = async () => { ... }

  // 사진 저장
  // const handleSavePhoto = async () => { ... }

  // 취소
  // const handleCancel = () => { ... }

  // 카메라 프리뷰 화면
  // if (isCameraOpen) { ... }

  // 사진 편집 화면
  // if (capturedPhoto) { ... }

  // 기본 화면
  // return ( ... )
}
*/

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

  useEffect(() => {
    const q = query(collection(db, "bulletins"), orderBy("createdAt", "desc"));
    const unsubscribe = onSnapshot(q, (querySnapshot) => {
      const docs: Bulletin[] = [];
      querySnapshot.forEach((doc) => {
        docs.push({ id: doc.id, ...doc.data() } as Bulletin);
      });
      setBulletins(docs);
    });
    return () => unsubscribe();
  }, []);

  // 체크 상태 로드 (컴포넌트 마운트 시)
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

    // 체크 상태 업데이트
    const newSet = new Set(checkedBulletins);
    newSet.add(bulletinId);
    setCheckedBulletins(newSet);

    // AsyncStorage에 저장
    if (mobileUser?.phoneNumber) {
      try {
        const key = `${CHECKED_BULLETINS_KEY}_${mobileUser.phoneNumber}`;
        await AsyncStorage.setItem(key, JSON.stringify(Array.from(newSet)));
      } catch (error) {
        console.error("체크 상태 저장 오류:", error);
      }
    }
  };

  // 화재 버튼 핸들러
  const handleFireEmergency = () => {
    Alert.alert("화재 신고", "화재 신고를 진행하시겠습니까?", [
      { text: "취소", style: "cancel" },
      {
        text: "신고",
        onPress: () => Alert.alert("신고 완료", "화재 신고가 접수되었습니다."),
      },
    ]);
  };

  // 요청 버튼 핸들러
  const handleRequest = () => {
    Alert.alert("요청", "요청 기능을 구현하시겠습니까?");
  };

  // 로그아웃 핸들러
  const handleLogout = () => {
    Alert.alert("로그아웃", "로그아웃 하시겠습니까?", [
      { text: "취소", style: "cancel" },
      {
        text: "로그아웃",
        onPress: async () => {
          try {
            // 1. authCheckIns 컬렉션에서 해당 사용자의 최신 레코드 찾기
            if (mobileUser?.phoneNumber) {
              const checkInsQuery = query(
                collection(db, "authCheckIns"),
                where("phoneNumber", "==", mobileUser.phoneNumber),
                orderBy("timestamp", "desc")
              );

              const querySnapshot = await getDocs(checkInsQuery);

              // checkOutTime이 없는 최신 레코드 찾기
              for (const docSnapshot of querySnapshot.docs) {
                const data = docSnapshot.data();
                if (!data.checkOutTime) {
                  // checkOutTime 업데이트
                  await updateDoc(doc(db, "authCheckIns", docSnapshot.id), {
                    checkOutTime: serverTimestamp(),
                  });
                  break; // 첫 번째 레코드만 업데이트
                }
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

      <Text style={styles.title}>GS건설 고위험작업 안전수칙</Text>

      {bulletins.length === 0 ? (
        <View style={styles.emptyBulletinCard}>
          <Text style={styles.emptyBulletinText}>
            현재 소속에 대한 공지사항이 없습니다.
          </Text>
        </View>
      ) : (
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
                    내용을 확인했습니다.
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

  return (
    <SafeAreaView style={styles.container}>
      {user && mobileUser ? (
        <>
          <View style={styles.welcomeContainer}>
            <Text style={styles.welcomeText}>GS건설 아테라자이 현장</Text>
          </View>
          {/* <LabelingCamera user={user} /> */}
          <BulletinList user={user} mobileUser={mobileUser} />
        </>
      ) : (
        <SignInForm />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
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
    paddingTop: 40,
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
    maxHeight: 200,
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
  cameraContainer: {
    width: "90%",
    padding: 10,
    borderWidth: 1,
    borderColor: "#FFD600",
    borderRadius: 5,
    marginBottom: 20,
    alignItems: "center",
    backgroundColor: "#FFFDE7",
  },
  cameraFullScreen: {
    flex: 1,
    width: "100%",
  },
  cameraPreview: {
    flex: 1,
  },
  cameraControls: {
    flex: 1,
    flexDirection: "row",
    justifyContent: "space-around",
    alignItems: "flex-end",
    paddingBottom: 30,
    backgroundColor: "transparent",
  },
  photoEditContainer: {
    width: "90%",
    padding: 10,
    borderWidth: 1,
    borderColor: "#FFD600",
    borderRadius: 5,
    marginBottom: 20,
    alignItems: "center",
    backgroundColor: "#FFFDE7",
  },
  previewImage: {
    width: "100%",
    height: 300,
    borderRadius: 5,
    marginBottom: 10,
  },
  labelInput: {
    width: "100%",
    height: 40,
    borderColor: "gray",
    borderWidth: 1,
    marginBottom: 10,
    padding: 10,
    backgroundColor: "white",
  },
  editButtons: {
    flexDirection: "row",
    justifyContent: "space-around",
    width: "100%",
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
});
