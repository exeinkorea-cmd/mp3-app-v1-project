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
  withDangerousMod,
} from "expo/config-plugins";
import * as fs from "fs";
import * as path from "path";

// -----------------------------------------------------------------------------
// [핵심 0] Buildscript Classpath에 Kotlin 1.9.25 강제 주입 (최우선 적용)
// -----------------------------------------------------------------------------
const withForcedKotlinBuildscript = (config: ExpoConfig) => {
  return withProjectBuildGradle(config, (modConfig) => {
    if (modConfig.modResults.language === "groovy") {
      const existingContent = modConfig.modResults.contents;

      // buildscript 블록을 파일 최상단에 추가하여 먼저 실행되도록 함
      const forceScript = `
// [Fix] Force Kotlin Gradle Plugin to 1.9.25 in the Buildscript Classpath
buildscript {
    repositories {
        google()
        mavenCentral()
    }
    dependencies {
        // 기존 1.9.24가 로드되기 전에 1.9.25를 먼저 선언
        classpath("org.jetbrains.kotlin:kotlin-gradle-plugin:1.9.25")
    }
    configurations.classpath {
        resolutionStrategy {
            // 혹시라도 다른 버전이 로드되려 하면 강제로 1.9.25로 고정
            force("org.jetbrains.kotlin:kotlin-gradle-plugin:1.9.25")
            force("org.jetbrains.kotlin:kotlin-stdlib:1.9.25")
        }
    }
}

// Ensure the variable is also set for any subprojects referencing it
ext {
    kotlinVersion = "1.9.25"
}
      `;

      // 이미 추가되어 있는지 확인
      if (
        !existingContent.includes(
          "// [Fix] Force Kotlin Gradle Plugin to 1.9.25 in the Buildscript Classpath"
        )
      ) {
        // 기존 내용의 맨 위에 강제 스크립트 추가
        modConfig.modResults.contents = forceScript + "\n" + existingContent;
      }
    }
    return modConfig;
  });
};

// -----------------------------------------------------------------------------
// [핵심 1] gradle.properties에 kotlinVersion 강제 주입 (양동 작전 - 속성값)
// -----------------------------------------------------------------------------
const withForcedKotlinProperty = (config: ExpoConfig) => {
  return withGradleProperties(config, (modConfig) => {
    // 여러 속성을 동시에 설정 (android.kotlinVersion과 kotlinVersion 모두)
    const propertiesToUpdate = [
      { key: "android.kotlinVersion", value: "1.9.25" },
      { key: "kotlinVersion", value: "1.9.25" },
      // Compose 컴파일러 호환성 체크 옵션 (안전장치)
      { key: "kotlin.version.compatibility.check", value: "true" },
    ];

    propertiesToUpdate.forEach(({ key, value }) => {
      const item = modConfig.modResults.find(
        (item) => item.type === "property" && item.key === key
      );
      if (item) {
        item.value = value;
      } else {
        modConfig.modResults.push({ type: "property", key, value });
      }
    });

    return modConfig;
  });
};

// -----------------------------------------------------------------------------
// [핵심 2-1] 프로젝트 루트 build.gradle에서 Kotlin 버전 강제 설정 + Resolution Strategy
// -----------------------------------------------------------------------------
const withForcedKotlinInProjectBuildGradle = (config: ExpoConfig) => {
  return withProjectBuildGradle(config, (modConfig) => {
    if (modConfig.modResults.language === "groovy") {
      let content = modConfig.modResults.contents;

      // 1. Brute Force: 1.9.24를 모두 1.9.25로 교체
      content = content.replace(/1\.9\.24/g, "1.9.25");

      // 2. kotlinVersion 변수 명시적으로 재선언
      content = content.replace(
        /kotlinVersion\s*=\s*.*$/gm,
        'kotlinVersion = "1.9.25"'
      );

      // 3. kotlin-gradle-plugin classpath에 버전 명시 (변수 사용)
      content = content.replace(
        /classpath\s*\(\s*["']org\.jetbrains\.kotlin:kotlin-gradle-plugin["']\s*\)/g,
        'classpath("org.jetbrains.kotlin:kotlin-gradle-plugin:$kotlinVersion")'
      );

      // 4. Resolution Strategy 추가 (최후의 필살기)
      // 이미 추가되어 있는지 확인
      if (
        !content.includes("// [EAS Build Fix] Force Kotlin Version to 1.9.25")
      ) {
        const resolutionStrategy = `
// [EAS Build Fix] Force Kotlin Version to 1.9.25
allprojects {
    configurations.all {
        resolutionStrategy.eachDependency { details ->
            if (details.requested.group == 'org.jetbrains.kotlin' && details.requested.name == 'kotlin-gradle-plugin') {
                details.useVersion "1.9.25"
            }
            if (details.requested.group == 'org.jetbrains.kotlin' && details.requested.name == 'kotlin-stdlib') {
                details.useVersion "1.9.25"
            }
        }
    }
}

// Ensure the variable is set for modules that rely on it
subprojects {
    buildscript {
        ext {
            kotlinVersion = "1.9.25"
        }
    }
}
        `;
        content = content + "\n" + resolutionStrategy;
      }

      modConfig.modResults.contents = content;
    }
    return modConfig;
  });
};

// -----------------------------------------------------------------------------
// [핵심 2-2] app/build.gradle에서 Kotlin 버전 강제 설정 (양동 작전 - 코드)
// -----------------------------------------------------------------------------
const withForcedKotlinInAppBuildGradle = (config: ExpoConfig) => {
  return withAppBuildGradle(config, (modConfig) => {
    if (modConfig.modResults.language === "groovy") {
      let content = modConfig.modResults.contents;

      // 1. Brute Force: 1.9.24를 모두 1.9.25로 교체
      content = content.replace(/1\.9\.24/g, "1.9.25");

      // 2. kotlinVersion 변수 명시적으로 재선언
      content = content.replace(
        /kotlinVersion\s*=\s*.*$/gm,
        'kotlinVersion = "1.9.25"'
      );

      modConfig.modResults.contents = content;
    }
    return modConfig;
  });
};

// -----------------------------------------------------------------------------
// [핵심 3] withDangerousMod로 모든 build.gradle 파일 직접 수정
// -----------------------------------------------------------------------------
const withForcedKotlinInAllBuildGradle = (config: ExpoConfig) => {
  return withDangerousMod(config, [
    "android",
    async (config) => {
      const androidDir = config.modRequest.platformProjectRoot;

      // android/build.gradle 수정
      const projectBuildGradle = path.join(androidDir, "build.gradle");
      if (fs.existsSync(projectBuildGradle)) {
        let content = fs.readFileSync(projectBuildGradle, "utf-8");
        content = content.replace(/1\.9\.24/g, "1.9.25");
        content = content.replace(
          /kotlinVersion\s*=\s*.*$/gm,
          'kotlinVersion = "1.9.25"'
        );
        content = content.replace(
          /classpath\s*\(\s*["']org\.jetbrains\.kotlin:kotlin-gradle-plugin["']\s*\)/g,
          'classpath("org.jetbrains.kotlin:kotlin-gradle-plugin:$kotlinVersion")'
        );
        fs.writeFileSync(projectBuildGradle, content, "utf-8");
      }

      // android/app/build.gradle 수정 (존재하는 경우)
      const appBuildGradle = path.join(androidDir, "app", "build.gradle");
      if (fs.existsSync(appBuildGradle)) {
        let content = fs.readFileSync(appBuildGradle, "utf-8");
        content = content.replace(/1\.9\.24/g, "1.9.25");
        content = content.replace(
          /kotlinVersion\s*=\s*.*$/gm,
          'kotlinVersion = "1.9.25"'
        );
        fs.writeFileSync(appBuildGradle, content, "utf-8");
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

  // Kotlin 버전 강제 적용 (Buildscript Classpath 강제를 최우선 적용)
  let finalConfig = withForcedKotlinBuildscript(baseConfig);
  finalConfig = withForcedKotlinInProjectBuildGradle(finalConfig);
  finalConfig = withForcedKotlinInAppBuildGradle(finalConfig);
  finalConfig = withForcedKotlinProperty(finalConfig);
  finalConfig = withForcedKotlinInAllBuildGradle(finalConfig);
  return finalConfig;
};
