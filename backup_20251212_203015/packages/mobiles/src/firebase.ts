import { initializeApp, getApps, getApp, type FirebaseApp } from "firebase/app";
import { getAuth, type Auth } from "firebase/auth";
import { getFunctions } from "firebase/functions";
import { getFirestore } from "firebase/firestore";
import { getStorage } from "firebase/storage";
import Constants from "expo-constants";

/**
 * Firebase 설정 가져오기
 * 우선순위: app.json extra > 환경 변수
 * 
 * 보안을 위해 app.json의 extra 필드나 환경 변수를 사용하세요.
 * 하드코딩된 키는 제거되었습니다.
 */
const getFirebaseConfig = () => {
  const extra = Constants.expoConfig?.extra || {};

  const config = {
    apiKey:
      extra.firebaseApiKey ||
      process.env.EXPO_PUBLIC_FIREBASE_API_KEY ||
      undefined,
    authDomain:
      extra.firebaseAuthDomain ||
      process.env.EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN ||
      undefined,
    projectId:
      extra.firebaseProjectId ||
      process.env.EXPO_PUBLIC_FIREBASE_PROJECT_ID ||
      undefined,
    storageBucket:
      extra.firebaseStorageBucket ||
      process.env.EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET ||
      undefined,
    messagingSenderId:
      extra.firebaseMessagingSenderId ||
      process.env.EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID ||
      undefined,
    appId:
      extra.firebaseAppId ||
      process.env.EXPO_PUBLIC_FIREBASE_APP_ID ||
      undefined,
    measurementId:
      extra.firebaseMeasurementId ||
      process.env.EXPO_PUBLIC_FIREBASE_MEASUREMENT_ID ||
      undefined,
  };

  // 필수 설정값 검증
  if (!config.apiKey || !config.projectId) {
    throw new Error(
      "Firebase 설정이 누락되었습니다. app.json의 extra 필드나 환경 변수를 확인하세요."
    );
  }

  // 개발 환경에서만 로그 출력 (선택사항)
  if (__DEV__) {
    console.log("Firebase Config loaded:", {
      apiKey: config.apiKey
        ? `${config.apiKey.substring(0, 10)}...`
        : "MISSING",
      authDomain: config.authDomain || "MISSING",
      projectId: config.projectId || "MISSING",
      hasExtra: !!extra.firebaseApiKey,
      hasEnv: !!process.env.EXPO_PUBLIC_FIREBASE_API_KEY,
    });
  }

  return config;
};

const firebaseConfig = getFirebaseConfig();

let app: FirebaseApp;
let auth: Auth;

if (getApps().length === 0) {
  app = initializeApp(firebaseConfig);
} else {
  app = getApp();
}

auth = getAuth(app);

const functions = getFunctions(app, "us-central1");
const db = getFirestore(app);
const storage = getStorage(app);

export { app, auth, functions, db, storage };
