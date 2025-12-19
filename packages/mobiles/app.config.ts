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
// 기존 buildscript 블록을 찾아서 수정하거나, 없으면 새로 추가
// -----------------------------------------------------------------------------
const withForcedKotlinBuildscript = (config: ExpoConfig) => {
  return withProjectBuildGradle(config, (modConfig) => {
    if (modConfig.modResults.language === "groovy") {
      let content = modConfig.modResults.contents;

      // 기존 buildscript 블록이 있는지 확인
      const buildscriptMatch = content.match(/buildscript\s*\{[\s\S]*?\n\}/);
      
      if (buildscriptMatch) {
        // 기존 buildscript 블록이 있으면 수정
        let buildscriptBlock = buildscriptMatch[0];
        
        // 1. kotlin-gradle-plugin 버전을 1.9.25로 강제
        buildscriptBlock = buildscriptBlock.replace(
          /classpath\s*\(\s*["']org\.jetbrains\.kotlin:kotlin-gradle-plugin[^"']*["']\s*\)/g,
          'classpath("org.jetbrains.kotlin:kotlin-gradle-plugin:1.9.25")'
        );
        
        // 2. classpath에 없으면 추가
        if (!buildscriptBlock.includes('kotlin-gradle-plugin')) {
          // dependencies 블록 찾기
          if (buildscriptBlock.includes('dependencies {')) {
            buildscriptBlock = buildscriptBlock.replace(
              /(dependencies\s*\{)/,
              '$1\n        classpath("org.jetbrains.kotlin:kotlin-gradle-plugin:1.9.25")'
            );
          } else {
            // dependencies 블록이 없으면 추가
            buildscriptBlock = buildscriptBlock.replace(
              /(buildscript\s*\{)/,
              '$1\n    dependencies {\n        classpath("org.jetbrains.kotlin:kotlin-gradle-plugin:1.9.25")\n    }'
            );
          }
        }
        
        // 3. resolutionStrategy 추가 (없으면)
        if (!buildscriptBlock.includes('configurations.classpath')) {
          buildscriptBlock = buildscriptBlock.replace(
            /(\n\})/,
            '\n    configurations.classpath {\n        resolutionStrategy {\n            force("org.jetbrains.kotlin:kotlin-gradle-plugin:1.9.25")\n            force("org.jetbrains.kotlin:kotlin-stdlib:1.9.25")\n        }\n    }$1'
          );
        } else {
          // 이미 있으면 force 추가
          if (!buildscriptBlock.includes('force("org.jetbrains.kotlin:kotlin-gradle-plugin:1.9.25")')) {
            buildscriptBlock = buildscriptBlock.replace(
              /(resolutionStrategy\s*\{)/,
              '$1\n            force("org.jetbrains.kotlin:kotlin-gradle-plugin:1.9.25")\n            force("org.jetbrains.kotlin:kotlin-stdlib:1.9.25")'
            );
          }
        }
        
        // 기존 블록을 수정된 블록으로 교체
        content = content.replace(buildscriptMatch[0], buildscriptBlock);
      } else {
        // 기존 buildscript 블록이 없으면 파일 최상단에 추가
        const forceScript = `// [Fix] Force Kotlin Gradle Plugin to 1.9.25 in the Buildscript Classpath
buildscript {
    repositories {
        google()
        mavenCentral()
    }
    dependencies {
        classpath("org.jetbrains.kotlin:kotlin-gradle-plugin:1.9.25")
    }
    configurations.classpath {
        resolutionStrategy {
            force("org.jetbrains.kotlin:kotlin-gradle-plugin:1.9.25")
            force("org.jetbrains.kotlin:kotlin-stdlib:1.9.25")
        }
    }
}

`;
        content = forceScript + content;
      }

      // ext 블록 추가 또는 수정
      if (content.includes('ext {')) {
        content = content.replace(
          /kotlinVersion\s*=\s*.*$/gm,
          'kotlinVersion = "1.9.25"'
        );
        if (!content.includes('kotlinVersion = "1.9.25"')) {
          content = content.replace(
            /(ext\s*\{)/,
            '$1\n    kotlinVersion = "1.9.25"'
          );
        }
      } else {
        content = content + '\n\next {\n    kotlinVersion = "1.9.25"\n}\n';
      }

      modConfig.modResults.contents = content;
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
    // 모든 프로젝트의 buildscript에 Kotlin 1.9.25 강제
    buildscript {
        repositories {
            google()
            mavenCentral()
        }
        dependencies {
            // 기존 kotlin-gradle-plugin을 찾아서 1.9.25로 교체
            configurations.classpath.resolutionStrategy {
                force("org.jetbrains.kotlin:kotlin-gradle-plugin:1.9.25")
                force("org.jetbrains.kotlin:kotlin-stdlib:1.9.25")
            }
        }
    }
    
    // 모든 의존성에 대해 Kotlin 버전 강제
    configurations.all {
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
    
    // ext 변수 설정
    ext {
        kotlinVersion = "1.9.25"
    }
}

// 모든 서브프로젝트에 buildscript 강제 적용
subprojects {
    afterEvaluate { project ->
        project.buildscript {
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
        project.ext.kotlinVersion = "1.9.25"
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
// [핵심 3] settings.gradle 파일 수정하여 모든 프로젝트에 Kotlin 버전 강제
// -----------------------------------------------------------------------------
const withForcedKotlinInSettingsGradle = (config: ExpoConfig) => {
  return withDangerousMod(config, [
    "android",
    async (config) => {
      const androidDir = config.modRequest.platformProjectRoot;
      const settingsGradle = path.join(androidDir, "settings.gradle");

      if (fs.existsSync(settingsGradle)) {
        let content = fs.readFileSync(settingsGradle, "utf-8");

        // 모든 프로젝트에 buildscript를 강제로 추가하는 코드
        const forceKotlinScript = `
// [Fix] Force Kotlin 1.9.25 for all subprojects
gradle.beforeProject { project ->
    project.buildscript {
        repositories {
            google()
            mavenCentral()
        }
        dependencies {
            def existingKotlin = configurations.classpath.dependencies.find { 
                it.group == 'org.jetbrains.kotlin' && it.name == 'kotlin-gradle-plugin' 
            }
            if (existingKotlin) {
                configurations.classpath.resolutionStrategy.force(
                    "org.jetbrains.kotlin:kotlin-gradle-plugin:1.9.25"
                )
            } else {
                dependencies {
                    classpath("org.jetbrains.kotlin:kotlin-gradle-plugin:1.9.25")
                }
            }
        }
        configurations.classpath {
            resolutionStrategy {
                force("org.jetbrains.kotlin:kotlin-gradle-plugin:1.9.25")
                force("org.jetbrains.kotlin:kotlin-stdlib:1.9.25")
            }
        }
    }
    project.ext.kotlinVersion = "1.9.25"
}
`;

        // 이미 추가되어 있지 않으면 추가
        if (!content.includes("// [Fix] Force Kotlin 1.9.25 for all subprojects")) {
          content = content + "\n" + forceKotlinScript;
          fs.writeFileSync(settingsGradle, content, "utf-8");
        }
      }

      return config;
    },
  ]);
};

// -----------------------------------------------------------------------------
// [핵심 4] withDangerousMod로 모든 build.gradle 파일 직접 수정
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
          /classpath\s*\(\s*["']org\.jetbrains\.kotlin:kotlin-gradle-plugin[^"']*["']\s*\)/g,
          'classpath("org.jetbrains.kotlin:kotlin-gradle-plugin:1.9.25")'
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

  // Kotlin 버전 강제 적용 (순서 중요!)
  // 1. buildscript 블록 수정/추가 (최우선)
  let finalConfig = withForcedKotlinBuildscript(baseConfig);
  // 2. project build.gradle 수정 (allprojects, subprojects 포함)
  finalConfig = withForcedKotlinInProjectBuildGradle(finalConfig);
  // 3. app build.gradle 수정
  finalConfig = withForcedKotlinInAppBuildGradle(finalConfig);
  // 4. gradle.properties 수정
  finalConfig = withForcedKotlinProperty(finalConfig);
  // 5. settings.gradle 수정 (모든 서브프로젝트에 적용)
  finalConfig = withForcedKotlinInSettingsGradle(finalConfig);
  // 6. 직접 파일 수정 (최후의 수단)
  finalConfig = withForcedKotlinInAllBuildGradle(finalConfig);
  return finalConfig;
};
