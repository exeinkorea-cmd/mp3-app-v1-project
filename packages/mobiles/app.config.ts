/**
 * Expo 앱 설정 파일
 * Expo SDK 52 + RN 0.76.5 환경에 맞춰 Kotlin 1.9.25를 강제 적용합니다.
 */
import { ExpoConfig, ConfigContext } from "expo/config";
import {
  withGradleProperties,
  withProjectBuildGradle,
  withDangerousMod,
} from "expo/config-plugins";
import * as fs from "fs";
import * as path from "path";

// -----------------------------------------------------------------------------
// [전략 1] gradle.properties에서 버전 변수 선언 (가장 표준적인 방법)
// -----------------------------------------------------------------------------
const withKotlinGradleProperty = (config: ExpoConfig) => {
  return withGradleProperties(config, (modConfig) => {
    // 1. kotlinVersion 설정
    const kotlinVersionItem = modConfig.modResults.find(
      (item) => item.type === "property" && item.key === "kotlinVersion"
    );
    if (kotlinVersionItem && kotlinVersionItem.type === "property") {
      kotlinVersionItem.value = "1.9.25";
    } else {
      modConfig.modResults.push({
        type: "property",
        key: "kotlinVersion",
        value: "1.9.25",
      });
    }

    // 2. 호환성 체크 무시 설정
    const suppressItem = modConfig.modResults.find(
      (item) =>
        item.type === "property" &&
        item.key === "suppressKotlinVersionCompatibilityCheck"
    );
    if (suppressItem && suppressItem.type === "property") {
      suppressItem.value = "true";
    } else {
      modConfig.modResults.push({
        type: "property",
        key: "suppressKotlinVersionCompatibilityCheck",
        value: "true",
      });
    }

    return modConfig;
  });
};

// -----------------------------------------------------------------------------
// [전략 2] Root build.gradle 직접 치환 (가장 강력한 방법)
// -----------------------------------------------------------------------------
const withForcedKotlinVersionInBuildGradle = (config: ExpoConfig) => {
  return withProjectBuildGradle(config, (modConfig) => {
    if (modConfig.modResults.language === "groovy") {
      let buildGradle = modConfig.modResults.contents;

      // 1. ext { ... } 블록 내의 kotlinVersion 변수값을 정규식으로 찾아 교체
      // 예: kotlinVersion = "1.9.24" -> kotlinVersion = "1.9.25"
      buildGradle = buildGradle.replace(
        /kotlinVersion\s*=\s*['"]1\.9\.2\d['"]/g,
        `kotlinVersion = "1.9.25"`
      );

      // 2. classpath 의존성에서 버전 명시적으로 교체
      // org.jetbrains.kotlin:kotlin-gradle-plugin:$kotlinVersion 형태일 수도 있고 버전이 박혀있을 수도 있음
      // 안전하게 특정 버전이 하드코딩된 경우를 1.9.25로 변경
      buildGradle = buildGradle.replace(
        /org\.jetbrains\.kotlin:kotlin-gradle-plugin:1\.9\.24/g,
        `org.jetbrains.kotlin:kotlin-gradle-plugin:1.9.25`
      );

      // 3. (옵션) Compose Compiler 버전도 1.5.15로 명시 (Expo 52 표준)
      buildGradle = buildGradle.replace(
        /kotlinCompilerExtensionVersion\s*=\s*['"]1\.5\.14['"]/g,
        `kotlinCompilerExtensionVersion = "1.5.15"`
      );

      modConfig.modResults.contents = buildGradle;
    }
    return modConfig;
  });
};

// -----------------------------------------------------------------------------
// [전략 3] node_modules 내부의 expo-modules-core 패치 (최후의 보루)
// -----------------------------------------------------------------------------
const withForcedKotlinInExpoModulesCore = (config: ExpoConfig) => {
  return withDangerousMod(config, [
    "android",
    async (config) => {
      const androidDir = config.modRequest.platformProjectRoot;
      const workspaceRoot = path.resolve(androidDir, "../..");

      const expoModulesCoreBuildGradle = path.join(
        workspaceRoot,
        "node_modules",
        "expo-modules-core",
        "android",
        "build.gradle"
      );

      if (fs.existsSync(expoModulesCoreBuildGradle)) {
        let content = fs.readFileSync(expoModulesCoreBuildGradle, "utf-8");

        // 1.9.24라고 적힌 모든 곳을 1.9.25로 변경
        // 이는 classpath, ext 변수 등을 모두 포함합니다.
        content = content.replace(/1\.9\.24/g, "1.9.25");

        // Compose 옵션 확인 및 주입 (1.5.15)
        if (content.includes("android {") && !content.includes("composeOptions")) {
          // 간단하게 android 블록 끝부분에 주입 시도하기보다는
          // compileOptions 뒤를 노리는 것이 안전
          const compileOptionsPattern = /(compileOptions\s*\{[^}]+\})/s;
          if (compileOptionsPattern.test(content)) {
            content = content.replace(
              compileOptionsPattern,
              `$1\n    composeOptions { kotlinCompilerExtensionVersion = "1.5.15" }`
            );
          }
        } else if (content.includes("kotlinCompilerExtensionVersion")) {
          // 이미 존재한다면 버전만 변경
          content = content.replace(
            /kotlinCompilerExtensionVersion\s*=\s*['"][^'"]+['"]/g,
            `kotlinCompilerExtensionVersion = "1.5.15"`
          );
        }

        fs.writeFileSync(expoModulesCoreBuildGradle, content, "utf-8");
      }

      return config;
    },
  ]);
};

export default ({ config }: ConfigContext): ExpoConfig => {
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

  const updatesUrl = easProjectId
    ? `https://u.expo.dev/${easProjectId}`
    : undefined;

  const baseConfig = {
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
              // [중요] Expo 52 표준에 맞게 1.9.25로 설정
              kotlinVersion: "1.9.25",
              // [추가] buildToolsVersion도 명시해주면 안정성이 올라갑니다 (선택사항)
              // buildToolsVersion: "35.0.0"
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
        firebaseApiKey,
        firebaseAuthDomain,
        firebaseProjectId,
        firebaseStorageBucket,
        firebaseMessagingSenderId,
        firebaseAppId,
        firebaseMeasurementId,
      },
      runtimeVersion: {
        policy: "appVersion",
      },
      updates: {
        url: updatesUrl || `https://u.expo.dev/${easProjectId}`,
      },
    },
  };

  // 순서대로 적용: Properties 설정 -> Root Gradle 수정 -> Module 직접 수정
  let finalConfig = withKotlinGradleProperty(baseConfig as ExpoConfig);
  finalConfig = withForcedKotlinVersionInBuildGradle(finalConfig);
  finalConfig = withForcedKotlinInExpoModulesCore(finalConfig);

  return finalConfig;
};
