"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.functions = exports.db = exports.auth = exports.app = void 0;
// '전기(SDK)'의 핵심 부품들을 가져옵니다.
const app_1 = require("firebase/app");
const auth_1 = require("firebase/auth");
const firestore_1 = require("firebase/firestore");
// [수정!] 'getFunctions' 부품도 가져옵니다.
const functions_1 = require("firebase/functions");
// --- 1단계: 모험가님의 '핵심 부품' (절대 비워두지 마세요!) ---
// (이 부분은 Firebase 콘솔에서 복사해 온 '내 앱'의 config 코드로 '대체'해주세요!)
const firebaseConfig = {
    apiKey: "YOUR_API_KEY_HERE",
    authDomain: "YOUR_AUTHDOMAIN_HERE",
    projectId: "mp3-app-v1-3cf12",
    storageBucket: "mp3-app-v1-3cf12.appspot.com",
    messagingSenderId: "...",
    appId: "...",
};
// -----------------------------------------------------
// '중앙 발전소' 가동!
const app = (0, app_1.initializeApp)(firebaseConfig);
exports.app = app;
// '전기'를 각 설비로 분배
const auth = (0, auth_1.getAuth)(app);
exports.auth = auth;
const db = (0, firestore_1.getFirestore)(app);
exports.db = db;
// [수정!] '전화기(Functions)'를 '지역 번호(us-central1)'와 함께 연결합니다!
// (에뮬레이터가 us-central1에서 실행 중이므로, '지역 번호'를 명시해야 합니다.)
const functions = (0, functions_1.getFunctions)(app, "us-central1");
exports.functions = functions;
//# sourceMappingURL=firebase.js.map