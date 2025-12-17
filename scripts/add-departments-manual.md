# Firestore에 소속명 추가하기

## 방법 1: Firebase Console에서 직접 추가 (가장 간단)

1. **Firebase Console 접속**
   - https://console.firebase.google.com 접속
   - 프로젝트 선택: `mp3-app-v1-3cf12`

2. **Firestore Database 열기**
   - 왼쪽 메뉴에서 "Firestore Database" 클릭
   - "데이터" 탭 선택

3. **departments 컬렉션 생성**
   - "컬렉션 시작" 또는 "+ 컬렉션 추가" 클릭
   - 컬렉션 ID: `departments` 입력

4. **소속명 문서 추가**
   다음 6개 소속명을 각각 문서로 추가:

   | 문서 ID (자동 생성 가능) | name 필드 |
   |------------------------|----------|
   | (자동) | GS건축 |
   | (자동) | GS시설 |
   | (자동) | 보림 |
   | (자동) | 보림형틀 |
   | (자동) | 보림철근 |
   | (자동) | 예은 |

   **추가 방법:**
   - 각 문서를 추가할 때:
     - 필드: `name` (문자열)
     - 값: 소속명 (예: "GS건축")
     - 필드: `createdAt` (타임스탬프) - 선택사항

## 방법 2: Node.js 스크립트 사용 (고급)

`scripts/add-departments.js` 파일을 실행하면 자동으로 추가됩니다.
(단, Firebase Admin SDK 설정이 필요합니다)





























