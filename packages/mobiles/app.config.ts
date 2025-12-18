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
import { withGradleProperties, withDangerousMod } from "expo/config-plugins";
import * as fs from "fs";
import * as path from "path";

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
// [핵심 2] build.gradle에서 kotlin-gradle-plugin 버전을 직접 수정
// -----------------------------------------------------------------------------
const withForcedKotlinGradlePlugin = (config: ExpoConfig) => {
  return withDangerousMod(config, [
    "android",
    async (config) => {
      const buildGradlePath = path.join(
        config.modRequest.platformProjectRoot,
        "build.gradle"
      );

      // build.gradle 파일이 존재하는 경우에만 수정
      if (fs.existsSync(buildGradlePath)) {
        let buildGradleContent = fs.readFileSync(buildGradlePath, "utf-8");

        // kotlin-gradle-plugin 버전을 1.9.25로 강제 설정
        // 패턴 1: classpath "org.jetbrains.kotlin:kotlin-gradle-plugin:VERSION"
        buildGradleContent = buildGradleContent.replace(
          /classpath\s+["']org\.jetbrains\.kotlin:kotlin-gradle-plugin:[^"']+["']/g,
          'classpath "org.jetbrains.kotlin:kotlin-gradle-plugin:1.9.25"'
        );

        // 패턴 2: kotlin("android") version "VERSION"
        buildGradleContent = buildGradleContent.replace(
          /kotlin\s*\(\s*["']android["']\s*\)\s+version\s+["'][^"']+["']/g,
          'kotlin("android") version "1.9.25"'
        );

        // 패턴 3: ext.kotlinVersion = "VERSION"
        if (buildGradleContent.includes("ext.kotlinVersion")) {
          buildGradleContent = buildGradleContent.replace(
            /ext\.kotlinVersion\s*=\s*["'][^"']+["']/g,
            'ext.kotlinVersion = "1.9.25"'
          );
        } else {
          // ext 블록이 있으면 추가, 없으면 생성
          if (buildGradleContent.includes("ext {")) {
            buildGradleContent = buildGradleContent.replace(
              /(ext\s*\{[^}]*)/,
              '$1\n    kotlinVersion = "1.9.25"'
            );
          } else {
            // buildscript 블록 내에 ext 추가
            buildGradleContent = buildGradleContent.replace(
              /(buildscript\s*\{[^}]*)/,
              '$1\n    ext.kotlinVersion = "1.9.25"'
            );
          }
        }

        fs.writeFileSync(buildGradlePath, buildGradleContent, "utf-8");
      }

      return config;
    },
  ]);
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

  // Kotlin 버전 강제 적용 (두 가지 방법 모두 적용)
  let finalConfig = withForcedKotlinVersionInProperties(baseConfig);
  finalConfig = withForcedKotlinGradlePlugin(finalConfig);
  return finalConfig;
};
