// 간단한 방법: Firebase CLI를 사용하여 소속명 추가
// 이 스크립트는 Firebase CLI가 설치되어 있고 로그인되어 있어야 합니다.

const { execSync } = require("child_process");
const fs = require("fs");
const path = require("path");

// 추가할 소속명 목록
const departments = [
  "GS건축",
  "GS시설",
  "보림",
  "보림형틀",
  "보림철근",
  "예은",
];

// 임시 JSON 파일 생성
const tempData = {};
departments.forEach((dept, index) => {
  tempData[`dept${index + 1}`] = {
    name: dept,
    createdAt: new Date().toISOString(),
  };
});

const tempFile = path.join(__dirname, "temp-departments.json");
fs.writeFileSync(tempFile, JSON.stringify(tempData, null, 2));

console.log("소속명 데이터 파일 생성 완료:", tempFile);
console.log("\nFirebase Console에서 다음 방법으로 추가하세요:");
console.log("1. https://console.firebase.google.com 접속");
console.log("2. 프로젝트 선택: mp3-app-v1-3cf12");
console.log("3. Firestore Database > 데이터 탭");
console.log("4. 'departments' 컬렉션 생성 (없는 경우)");
console.log("5. 각 소속명을 문서로 추가:\n");

departments.forEach((dept, index) => {
  console.log(`   문서 ID: dept${index + 1} (또는 자동 생성)`);
  console.log(`   name: "${dept}"`);
  console.log(`   createdAt: ${new Date().toISOString()}\n`);
});

console.log("\n또는 아래 JSON을 복사하여 Firebase Console에서 import하세요:");
console.log(JSON.stringify(tempData, null, 2));
































