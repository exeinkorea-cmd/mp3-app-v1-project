/**
 * Expo 앱 설정 파일
 * 환경 변수에서 Firebase 및 EAS 설정을 동적으로 읽어옵니다.
 *
 * 환경 변수 설정:
 * - EXPO_PUBLIC_FIREBASE_API_KEY
 * - EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN
 * - EXPO_PUBLIC_FIREBASE_PROJECT_ID
 * - EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET
 * - EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID
 * - EXPO_PUBLIC_FIREBASE_APP_ID
 * - EXPO_PUBLIC_FIREBASE_MEASUREMENT_ID
 * - EAS_PROJECT_ID
 *
 * 또는 .env 파일을 사용할 수 있습니다.
 */
import { ExpoConfig, ConfigContext } from "expo/config";
import {
  withGradleProperties,
  withProjectBuildGradle,
  withAppBuildGradle,
} from "expo/config-plugins";

// -----------------------------------------------------------------------------
// [핵심 1] gradle.properties에 kotlinVersion 추가
// -----------------------------------------------------------------------------
const withForcedKotlinVersionInProperties = (config: ExpoConfig) => {
  return withGradleProperties(config, (config) => {
    const key = "kotlinVersion";
    const value = "1.9.25";

    // 기존 kotlinVersion 설정 삭제
    config.modResults = config.modResults.filter((item) => {
      if (item.type === "property" && item.key === key) {
        return false;
      }
      return true;
    });

    // 새로운 버전 추가
    config.modResults.push({
      type: "property",
      key,
      value,
    });

    return config;
  });
};

// -----------------------------------------------------------------------------
// [핵심 2-1] 프로젝트 루트 build.gradle에서 kotlinVersion을 강제로 1.9.25로 설정
// -----------------------------------------------------------------------------
const withForcedKotlinInProjectBuildGradle = (config: ExpoConfig) => {
  return withProjectBuildGradle(config, (modConfig) => {
    if (modConfig.modResults.language === "groovy") {
      const buildGradleContent = modConfig.modResults.contents;

      // kotlinVersion = 뒤에 뭐가 오든 그 줄 전체를 잡아서 1.9.25로 교체
      // findProperty('android.kotlinVersion') ?: '1.9.24' 같은 복잡한 형태도 잡음
      const newBuildGradleContent = buildGradleContent.replace(
        /kotlinVersion\s*=\s*.*$/gm,
        'kotlinVersion = "1.9.25"'
      );

      modConfig.modResults.contents = newBuildGradleContent;
    }
    return modConfig;
  });
};

// -----------------------------------------------------------------------------
// [핵심 2-2] app/build.gradle에서 kotlinVersion 수정 (필요한 경우)
// -----------------------------------------------------------------------------
const withForcedKotlinInAppBuildGradle = (config: ExpoConfig) => {
  return withAppBuildGradle(config, (modConfig) => {
    if (modConfig.modResults.language === "groovy") {
      const buildGradleContent = modConfig.modResults.contents;

      // kotlinVersion = 뒤에 뭐가 오든 그 줄 전체를 잡아서 1.9.25로 교체
      const newBuildGradleContent = buildGradleContent.replace(
        /kotlinVersion\s*=\s*.*$/gm,
        'kotlinVersion = "1.9.25"'
      );

      modConfig.modResults.contents = newBuildGradleContent;
    }
    return modConfig;
  });
};

export default ({ config }: ConfigContext): ExpoConfig => {
  // 환경 변수에서 값 가져오기 (기본값: app.json의 projectId)
  const easProjectId =
    process.env.EAS_PROJECT_ID ||
    process.env.EXPO_PUBLIC_EAS_PROJECT_ID ||
    "4045de0c-1a46-4b62-a085-63825983f521";
  const firebaseApiKey = process.env.EXPO_PUBLIC_FIREBASE_API_KEY;
  const firebaseAuthDomain = process.env.EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN;
  const firebaseProjectId = process.env.EXPO_PUBLIC_FIREBASE_PROJECT_ID;
  const firebaseStorageBucket = process.env.EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET;
  const firebaseMessagingSenderId =
    process.env.EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID;
  const firebaseAppId = process.env.EXPO_PUBLIC_FIREBASE_APP_ID;
  const firebaseMeasurementId = process.env.EXPO_PUBLIC_FIREBASE_MEASUREMENT_ID;

  // EAS Project ID가 있으면 updates URL 생성
  const updatesUrl = easProjectId
    ? `https://u.expo.dev/${easProjectId}`
    : undefined;

  // 기본 설정 생성
  const baseConfig: ExpoConfig = {
    ...config,
    expo: {
      name: "mobiles",
      slug: "mobiles",
      owner: "himill",
      version: "1.0.0",
      orientation: "portrait",
      icon: "./assets/icon.png",
      userInterfaceStyle: "light",
      newArchEnabled: false,
      splash: {
        image: "./assets/splash-icon.png",
        resizeMode: "contain",
        backgroundColor: "#ffffff",
      },
      ios: {
        supportsTablet: true,
        bundleIdentifier: "com.mp3.mobiles",
      },
      android: {
        adaptiveIcon: {
          foregroundImage: "./assets/adaptive-icon.png",
          backgroundColor: "#ffffff",
        },
        package: "com.mp3.mobiles",
      },
      plugins: [
        [
          "expo-build-properties",
          {
            android: {
              kotlinVersion: "1.9.25",
            },
          },
        ],
      ],
      web: {
        favicon: "./assets/favicon.png",
      },
      extra: {
        eas: {
          projectId: easProjectId,
        },
        firebaseApiKey: firebaseApiKey,
        firebaseAuthDomain: firebaseAuthDomain,
        firebaseProjectId: firebaseProjectId,
        firebaseStorageBucket: firebaseStorageBucket,
        firebaseMessagingSenderId: firebaseMessagingSenderId,
        firebaseAppId: firebaseAppId,
        firebaseMeasurementId: firebaseMeasurementId,
      },
      runtimeVersion: {
        policy: "appVersion",
      },
      updates: {
        url: updatesUrl || `https://u.expo.dev/${easProjectId}`,
      },
    },
  };

  // Kotlin 버전 강제 적용 (세 가지 방법 모두 적용)
  let finalConfig = withForcedKotlinVersionInProperties(baseConfig);
  finalConfig = withForcedKotlinInProjectBuildGradle(finalConfig);
  finalConfig = withForcedKotlinInAppBuildGradle(finalConfig);
  return finalConfig;
};
