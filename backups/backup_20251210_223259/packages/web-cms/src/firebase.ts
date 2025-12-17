import { initializeApp, FirebaseApp } from "firebase/app";
import { getAuth, Auth } from "firebase/auth";
import { getFunctions, Functions } from "firebase/functions";
import { getFirestore, Firestore } from "firebase/firestore";

// Firebase 설정 타입
interface FirebaseConfig {
  apiKey: string | undefined;
  authDomain: string | undefined;
  projectId: string | undefined;
  storageBucket: string | undefined;
  messagingSenderId: string | undefined;
  appId: string | undefined;
  measurementId: string | undefined;
}

// 환경 변수에서 Firebase 설정을 가져옵니다 (.env 파일 사용)
// 보안을 위해 .env 파일을 사용하세요. .env.example을 참고하여 .env 파일을 생성하세요.
const firebaseConfig: FirebaseConfig = {
  apiKey: process.env.REACT_APP_FIREBASE_API_KEY,
  authDomain: process.env.REACT_APP_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.REACT_APP_FIREBASE_PROJECT_ID,
  storageBucket: process.env.REACT_APP_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.REACT_APP_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.REACT_APP_FIREBASE_APP_ID,
  measurementId: process.env.REACT_APP_FIREBASE_MEASUREMENT_ID,
};

// 필수 설정값 검증
if (!firebaseConfig.apiKey || !firebaseConfig.projectId) {
  throw new Error(
    "Firebase 설정이 누락되었습니다. .env 파일을 확인하세요. .env.example을 참고하여 .env 파일을 생성하세요."
  );
}

// Firebase 앱 초기화
const app: FirebaseApp = initializeApp(firebaseConfig);

// Firebase 서비스 초기화
const auth: Auth = getAuth(app);
const functions: Functions = getFunctions(app, "us-central1");
const db: Firestore = getFirestore(app);

export { app, auth, functions, db };




















