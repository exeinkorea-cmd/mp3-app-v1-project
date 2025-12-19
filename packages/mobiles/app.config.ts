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
// [방법 2] build.gradle에서 Kotlin 버전을 정규식으로 강제 교체 (정밀 타격)
// -----------------------------------------------------------------------------
const withForcedKotlinVersionInBuildGradle = (config: ExpoConfig) => {
  return withProjectBuildGradle(config, (modConfig) => {
    if (modConfig.modResults.language === "groovy") {
      let buildGradle = modConfig.modResults.contents;

      // -----------------------------------------------------------------------
      // 작전 1: ext.kotlinVersion 변수 강제 교체
      // -----------------------------------------------------------------------
      // 설명: "kotlinVersion = ..." 으로 시작하는 모든 패턴을 찾아서 1.9.25로 바꿉니다.
      // (Expo 기본 설정인 findProperty(...) 구문까지 싹 덮어씁니다.)
      const kotlinVersionPattern =
        /kotlinVersion\s*=\s*(?:findProperty\(['"]android\.kotlinVersion['"]\)\s*\?:\s*)?['"][\d.]+['"]/g;

      // 만약 패턴이 있다면 교체, 없다면 ext 블록 안에 강제 주입을 위해 플래그 설정
      if (buildGradle.match(kotlinVersionPattern)) {
        buildGradle = buildGradle.replace(
          kotlinVersionPattern,
          `kotlinVersion = "1.9.25"`
        );
      } else {
        // 패턴을 못 찾았을 경우(매우 드뭄), buildscript 상단에 변수 선언을 추가
        buildGradle = buildGradle.replace(
          /buildscript\s*\{/,
          `buildscript {\n    ext.kotlinVersion = "1.9.25"`
        );
      }

      // -----------------------------------------------------------------------
      // 작전 2: Classpath 의존성 직접 교체 (가장 중요!)
      // -----------------------------------------------------------------------
      // 설명: "org.jetbrains.kotlin:kotlin-gradle-plugin:X.X.X" 부분을 찾아서
      // 버전을 1.9.25로 직접 바꿔버립니다. 변수를 참조하지 않고 하드코딩으로 박습니다.
      const classpathPattern =
        /classpath\s*\(['"]org\.jetbrains\.kotlin:kotlin-gradle-plugin:[^'"]+['"]\)/g;

      if (buildGradle.match(classpathPattern)) {
        buildGradle = buildGradle.replace(
          classpathPattern,
          `classpath("org.jetbrains.kotlin:kotlin-gradle-plugin:1.9.25")`
        );
      } else {
        // 만약 ${kotlinVersion} 변수를 쓰고 있다면, 그것도 찾아서 교체
        const variableClasspathPattern =
          /classpath\s*\(['"]org\.jetbrains\.kotlin:kotlin-gradle-plugin:\$\{.*\}['"]\)/g;
        buildGradle = buildGradle.replace(
          variableClasspathPattern,
          `classpath("org.jetbrains.kotlin:kotlin-gradle-plugin:1.9.25")`
        );
      }

      // 추가 안전장치: 1.9.24를 모두 1.9.25로 교체
      buildGradle = buildGradle.replace(/1\.9\.24/g, "1.9.25");

      // -----------------------------------------------------------------------
      // 작전 3: allprojects와 subprojects 블록 추가 (서브프로젝트 강제 적용)
      // -----------------------------------------------------------------------
      // 이미 추가되어 있는지 확인
      if (
        !buildGradle.includes(
          "// [Fix] Force Kotlin 1.9.25 for all subprojects"
        )
      ) {
        const allProjectsBlock = `
// [Fix] Force Kotlin 1.9.25 for all subprojects
allprojects {
    buildscript {
        repositories {
            google()
            mavenCentral()
        }
        dependencies {
            configurations.classpath.resolutionStrategy {
                force("org.jetbrains.kotlin:kotlin-gradle-plugin:1.9.25")
                force("org.jetbrains.kotlin:kotlin-stdlib:1.9.25")
            }
        }
    }
    ext {
        kotlinVersion = "1.9.25"
    }
}

subprojects {
    afterEvaluate { project ->
        project.buildscript {
            dependencies {
                configurations.classpath.resolutionStrategy {
                    force("org.jetbrains.kotlin:kotlin-gradle-plugin:1.9.25")
                    force("org.jetbrains.kotlin:kotlin-stdlib:1.9.25")
                }
            }
        }
        project.ext.kotlinVersion = "1.9.25"
    }
}
`;
        buildGradle = buildGradle + "\n" + allProjectsBlock;
      }

      // -----------------------------------------------------------------------
      // 작전 4: Compose 컴파일러 옵션 직접 주입 (Compiler Arg Injection)
      // -----------------------------------------------------------------------
      // 이미 추가되어 있는지 확인
      if (
        !buildGradle.includes(
          "// [Fix] Force Suppress Compose Compiler Version Check"
        )
      ) {
        const suppressComposeScript = `
// [Fix] Force Suppress Compose Compiler Version Check
allprojects {
    tasks.withType(org.jetbrains.kotlin.gradle.tasks.KotlinCompile).configureEach {
        kotlinOptions {
            freeCompilerArgs += [
                "-P",
                "plugin:androidx.compose.compiler.plugins.kotlin:suppressKotlinVersionCompatibilityCheck=true"
            ]
        }
    }
}
`;
        buildGradle = buildGradle + "\n" + suppressComposeScript;
      }

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
