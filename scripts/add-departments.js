// Firestore에 테스트용 소속명 추가 스크립트
const admin = require("firebase-admin");
const serviceAccount = require("../serviceAccountKey.json"); // 필요시 생성

// Firebase Admin SDK 초기화
// 주의: 실제 프로덕션에서는 환경 변수나 다른 방법으로 인증 정보를 관리하세요
try {
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
  });
} catch (error) {
  // 이미 초기화된 경우
  if (error.code !== "app/already-initialized") {
    console.error("Firebase 초기화 실패:", error);
    process.exit(1);
  }
}

const db = admin.firestore();

// 추가할 소속명 목록
const departments = [
  "GS건축",
  "GS시설",
  "보림",
  "보림형틀",
  "보림철근",
  "예은",
];

async function addDepartments() {
  console.log("소속명 추가를 시작합니다...");

  try {
    for (const deptName of departments) {
      // 중복 체크
      const existing = await db
        .collection("departments")
        .where("name", "==", deptName)
        .get();

      if (existing.empty) {
        await db.collection("departments").add({
          name: deptName,
          createdAt: admin.firestore.FieldValue.serverTimestamp(),
        });
        console.log(`✓ "${deptName}" 추가 완료`);
      } else {
        console.log(`- "${deptName}" 이미 존재함 (건너뜀)`);
      }
    }

    console.log("\n모든 소속명 추가가 완료되었습니다!");
    process.exit(0);
  } catch (error) {
    console.error("에러 발생:", error);
    process.exit(1);
  }
}

addDepartments();





























