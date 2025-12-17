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

이 패키지는 `app.config.ts`를 사용하여 환경 변수에서 설정을 동적으로 읽어옵니다.

**환경 변수 설정 방법:**

1. `packages/mobiles/.env.example` 파일을 복사하여 `.env` 생성:
   ```bash
   cd packages/mobiles
   copy .env.example .env
   ```

2. `.env` 파일에 실제 Firebase 및 EAS 설정값 입력:
   ```
   EXPO_PUBLIC_FIREBASE_API_KEY=your_firebase_api_key
   EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN=your_project_id.firebaseapp.com
   EXPO_PUBLIC_FIREBASE_PROJECT_ID=your_project_id
   EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET=your_project_id.firebasestorage.app
   EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=your_messaging_sender_id
   EXPO_PUBLIC_FIREBASE_APP_ID=your_app_id
   EXPO_PUBLIC_FIREBASE_MEASUREMENT_ID=your_measurement_id
   EAS_PROJECT_ID=your_eas_project_id
   ```

3. 또는 시스템 환경 변수로 설정할 수도 있습니다.

**참고:**
- `app.config.ts`가 있으면 Expo는 자동으로 이 파일을 사용합니다.
- 기존 `app.json`은 `.gitignore`에 추가되어 Git에 커밋되지 않습니다.
- `app.json.example`은 참고용 템플릿입니다.

#### Web-CMS 패키지

1. `packages/web-cms/.env.example` 파일을 복사하여 `.env` 생성:
   ```bash
   cd packages/web-cms
   copy .env.example .env
   ```

2. `.env` 파일에 Firebase 및 Gemini API 설정값 입력:
   ```
   REACT_APP_FIREBASE_API_KEY=your_firebase_api_key
   REACT_APP_FIREBASE_AUTH_DOMAIN=your_project_id.firebaseapp.com
   REACT_APP_FIREBASE_PROJECT_ID=your_project_id
   REACT_APP_FIREBASE_STORAGE_BUCKET=your_project_id.firebasestorage.app
   REACT_APP_FIREBASE_MESSAGING_SENDER_ID=your_messaging_sender_id
   REACT_APP_FIREBASE_APP_ID=your_app_id
   REACT_APP_FIREBASE_MEASUREMENT_ID=your_measurement_id
   REACT_APP_GEMINI_API_KEY=your_gemini_api_key
   ```

⚠️ **중요**: 
- `.env` 파일과 실제 키가 포함된 `app.json`은 Git에 커밋하지 마세요. `.gitignore`에 이미 포함되어 있습니다.
- `.env.example` 파일은 템플릿이므로 Git에 포함되어 있습니다.

### 📁 프로젝트 구조
