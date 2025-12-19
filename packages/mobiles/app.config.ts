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
  withDangerousMod,
} from "expo/config-plugins";
import * as fs from "fs";
import * as path from "path";

// -----------------------------------------------------------------------------
// [방법 1] gradle.properties에 suppressKotlinVersionCompatibilityCheck 추가
// -----------------------------------------------------------------------------
const withSuppressKotlinVersionCheck = (config: ExpoConfig) => {
  return withGradleProperties(config, (modConfig) => {
    // suppressKotlinVersionCompatibilityCheck 속성 추가
    const existingItem = modConfig.modResults.find(
      (item) =>
        item.type === "property" &&
        item.key === "suppressKotlinVersionCompatibilityCheck"
    );

    if (existingItem) {
      existingItem.value = "true";
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
// [방법 2] Deep Injection: build.gradle 최상단에 강제 스크립트 추가 (하위 모듈 타겟팅)
// -----------------------------------------------------------------------------
const withForcedKotlinVersionInBuildGradle = (config: ExpoConfig) => {
  return withProjectBuildGradle(config, (modConfig) => {
    if (modConfig.modResults.language === "groovy") {
      let buildGradle = modConfig.modResults.contents;

      // -----------------------------------------------------------------------
      // [핵심 전략] Deep Injection - 파일 최상단에 강제 스크립트 추가
      // 1. buildscript classpath 강제 (도구 버전 고정)
      // 2. allprojects & subprojects 모두에 컴파일 옵션 주입 (라이브러리 버전 고정)
      // 3. afterEvaluate로 나중에 추가되는 설정까지 덮어쓰기 (확인 사살)
      // -----------------------------------------------------------------------
      if (
        !buildGradle.includes(
          "// [Fix] Deep Injection to Force Kotlin 1.9.25 and Suppress Warnings"
        )
      ) {
        const forceScript = `
// [Fix] Deep Injection to Force Kotlin 1.9.25 and Suppress Warnings
buildscript {
    repositories {
        google()
        mavenCentral()
    }
    dependencies {
        classpath("org.jetbrains.kotlin:kotlin-gradle-plugin:1.9.25")
    }
}

allprojects {
    tasks.withType(org.jetbrains.kotlin.gradle.tasks.KotlinCompile).configureEach {
        kotlinOptions {
            jvmTarget = "1.8"
            // 컴파일러에게 직접 경고 무시 플래그 전달
            freeCompilerArgs += [
                "-P",
                "plugin:androidx.compose.compiler.plugins.kotlin:suppressKotlinVersionCompatibilityCheck=true"
            ]
        }
    }
    
    // Compose Compiler 옵션을 android 블록에도 추가
    afterEvaluate { project ->
        if (project.hasProperty("android")) {
            project.android {
                compileOptions {
                    sourceCompatibility JavaVersion.VERSION_1_8
                    targetCompatibility JavaVersion.VERSION_1_8
                }
            }
        }
    }
}

subprojects {
    // afterEvaluate 없이도 즉시 적용 (타이밍 문제 해결)
    tasks.withType(org.jetbrains.kotlin.gradle.tasks.KotlinCompile).configureEach {
        kotlinOptions {
            jvmTarget = "1.8"
            freeCompilerArgs += [
                "-P",
                "plugin:androidx.compose.compiler.plugins.kotlin:suppressKotlinVersionCompatibilityCheck=true"
            ]
        }
    }
    
    afterEvaluate { project ->
        // 하위 모듈(expo-modules-core 등)의 의존성 강제 교체
        project.configurations.all {
            resolutionStrategy.eachDependency { details ->
                if (details.requested.group == 'org.jetbrains.kotlin') {
                    if (details.requested.name == 'kotlin-gradle-plugin' || 
                        details.requested.name == 'kotlin-stdlib' ||
                        details.requested.name.startsWith('kotlin-')) {
                        details.useVersion "1.9.25"
                    }
                }
            }
        }
        
        // Android 모듈인 경우 compileOptions 설정
        if (project.hasProperty("android")) {
            project.android {
                compileOptions {
                    sourceCompatibility JavaVersion.VERSION_1_8
                    targetCompatibility JavaVersion.VERSION_1_8
                }
            }
        }
        
        // buildscript에도 강제 적용
        if (project.buildscript) {
            project.buildscript {
                dependencies {
                    configurations.classpath.resolutionStrategy {
                        force("org.jetbrains.kotlin:kotlin-gradle-plugin:1.9.25")
                        force("org.jetbrains.kotlin:kotlin-stdlib:1.9.25")
                    }
                }
            }
        }
        
        project.ext.kotlinVersion = "1.9.25"
    }
}

ext {
    kotlinVersion = "1.9.25"
}
        `;

        // 기존 내용의 맨 위에 붙여서 우선권을 가져갑니다.
        buildGradle = forceScript + "\n" + buildGradle;
      }

      // -----------------------------------------------------------------------
      // 추가 안전장치: 기존 코드에서 1.9.24를 모두 1.9.25로 교체
      // -----------------------------------------------------------------------
      buildGradle = buildGradle.replace(/1\.9\.24/g, "1.9.25");

      // kotlinVersion 변수 강제 교체
      buildGradle = buildGradle.replace(
        /kotlinVersion\s*=\s*(?:findProperty\(['"]android\.kotlinVersion['"]\)\s*\?:\s*)?['"][\d.]+['"]/g,
        `kotlinVersion = "1.9.25"`
      );

      // classpath 의존성 직접 교체
      buildGradle = buildGradle.replace(
        /classpath\s*\(['"]org\.jetbrains\.kotlin:kotlin-gradle-plugin:[^'"]+['"]\)/g,
        `classpath("org.jetbrains.kotlin:kotlin-gradle-plugin:1.9.25")`
      );

      buildGradle = buildGradle.replace(
        /classpath\s*\(['"]org\.jetbrains\.kotlin:kotlin-gradle-plugin:\$\{.*\}['"]\)/g,
        `classpath("org.jetbrains.kotlin:kotlin-gradle-plugin:1.9.25")`
      );

      modConfig.modResults.contents = buildGradle;
    }
    return modConfig;
  });
};

// -----------------------------------------------------------------------------
// [방법 3] expo-modules-core의 build.gradle 직접 수정 (최후의 수단)
// -----------------------------------------------------------------------------
const withForcedKotlinInExpoModulesCore = (config: ExpoConfig) => {
  return withDangerousMod(config, [
    "android",
    async (config) => {
      const androidDir = config.modRequest.platformProjectRoot;
      const workspaceRoot = path.resolve(androidDir, "../..");

      // expo-modules-core의 build.gradle 경로
      const expoModulesCoreBuildGradle = path.join(
        workspaceRoot,
        "node_modules",
        "expo-modules-core",
        "android",
        "build.gradle"
      );

      if (fs.existsSync(expoModulesCoreBuildGradle)) {
        let content = fs.readFileSync(expoModulesCoreBuildGradle, "utf-8");

        // 1.9.24를 모두 1.9.25로 교체
        content = content.replace(/1\.9\.24/g, "1.9.25");

        // kotlinVersion 변수 교체
        content = content.replace(
          /kotlinVersion\s*=\s*.*$/gm,
          'kotlinVersion = "1.9.25"'
        );

        // classpath 교체
        content = content.replace(
          /classpath\s*\(\s*["']org\.jetbrains\.kotlin:kotlin-gradle-plugin[^"']*["']\s*\)/g,
          'classpath("org.jetbrains.kotlin:kotlin-gradle-plugin:1.9.25")'
        );

        fs.writeFileSync(expoModulesCoreBuildGradle, content, "utf-8");
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

  // 네 가지 방법 모두 적용
  let finalConfig = withSuppressKotlinVersionCheck(baseConfig);
  finalConfig = withForcedKotlinVersionInBuildGradle(finalConfig);
  finalConfig = withForcedKotlinInExpoModulesCore(finalConfig);
  return finalConfig;
};
