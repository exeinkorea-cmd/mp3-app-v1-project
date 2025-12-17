# MP3 App V1 Project

현장 업무 관리 및 보고용 툴

## 📦 설치 가이드

이 프로젝트는 **각 패키지별로 독립 설치**를 기본 원칙으로 합니다.

### ⚠️ 중요: 각 패키지별 설치

루트에서 `npm install`을 실행하면 의존성 충돌이 발생할 수 있습니다.  
각 패키지 디렉토리에서 개별적으로 설치하세요.

### 설치 순서

#### 1. Common 패키지 (공통 라이브러리)

cd packages/common
npm install#### 2. Functions 패키지 (Firebase Functions)
cd packages/functions
npm install#### 3. Web CMS 패키지 (관리자 웹 앱)
cd packages/web-cms
npm install

#### 4. Mobiles 패키지 (모바일 앱)

cd packages/mobiles
npm install### 🚀 실행 방법

#### 웹 CMS 실행

# 루트에서

npm run start:web

# 또는 직접

cd packages/web-cms
npm start#### 모바일 앱 실행h

# 루트에서

npm run start:mobile

# 또는 직접

cd packages/mobiles
npm start#### Firebase Functions 실행
npm run serve:functions### 🔧 빌드

#### Common 패키지 빌드

npm run build:common#### Web CMS 빌드
npm run build:web#### Mobiles EAS 빌드
cd packages/mobiles
npx eas build --platform android --profile preview### 📝 왜 각 패키지별로 설치하나요?

- `web-cms`: `react-scripts@5.0.1` (TypeScript 3.x/4.x만 지원)
- `mobiles`: `expo@~52.0.0` (TypeScript 5.x 필요)
- 각 패키지가 서로 다른 의존성 요구사항을 가지고 있어 독립 설치가 필요합니다.

### 🛠️ 기술 스택

- **Web CMS**: React 19, TypeScript 5, Firebase
- **Mobiles**: Expo 52, React Native 0.76, TypeScript 5
- **Functions**: TypeScript, Firebase Functions
- **Common**: 공통 Firebase 설정 및 유틸리티

### 🔐 보안 설정 (환경 변수)

보안을 위해 Firebase API 키와 같은 민감한 정보는 환경 변수나 설정 파일로 관리합니다.

#### Mobiles 패키지

1. `packages/mobiles/app.json.example` 파일을 복사하여 `app.json` 생성
2. `app.json`의 `extra` 필드에 Firebase 설정값 입력
3. 또는 환경 변수 사용:
   - `EXPO_PUBLIC_FIREBASE_API_KEY`
   - `EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN`
   - `EXPO_PUBLIC_FIREBASE_PROJECT_ID`
   - 등등...

#### Web-CMS 패키지

1. `packages/web-cms/.env.example` 파일을 복사하여 `.env` 생성 (필요시)
2. `.env` 파일에 Firebase 설정값 입력:
   ```
   REACT_APP_FIREBASE_API_KEY=your_api_key
   REACT_APP_FIREBASE_AUTH_DOMAIN=your_project_id.firebaseapp.com
   REACT_APP_FIREBASE_PROJECT_ID=your_project_id
   ...
   ```

⚠️ **중요**: `.env` 파일과 `app.json`에 실제 키가 포함된 파일은 Git에 커밋하지 마세요. `.gitignore`에 이미 포함되어 있습니다.

### 📁 프로젝트 구조
