/**
 * Expo 앱 설정 파일
 * Root build.gradle의 Kotlin 버전을 1.9.25로 강제 치환하는 전략
 * + KSP 플러그인 버전 명시적 설정
 */
import { ExpoConfig, ConfigContext } from "expo/config";
import {
  withProjectBuildGradle,
  withDangerousMod,
  withGradleProperties,
} from "expo/config-plugins";
import * as fs from "fs";
import * as path from "path";

// -----------------------------------------------------------------------------
// [전략 0] gradle.properties에 Kotlin 버전 강제 설정
// 주석 처리: Node.js 22 설치 후 Kotlin 버전 강제 설정 불필요
// -----------------------------------------------------------------------------
/*
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

    // 3. [NEW] 빌드 최적화 설정
    const buildConfigItem = modConfig.modResults.find(
      (item) =>
        item.type === "property" &&
        item.key === "android.defaults.buildfeatures.buildconfig"
    );
    if (!buildConfigItem) {
      modConfig.modResults.push({
        type: "property",
        key: "android.defaults.buildfeatures.buildconfig",
        value: "true",
      });
    }

    // 4. [NEW] Kotlin 컴파일러 옵션
    const kotlinIncrementalItem = modConfig.modResults.find(
      (item) => item.type === "property" && item.key === "kotlin.incremental"
    );
    if (!kotlinIncrementalItem) {
      modConfig.modResults.push({
        type: "property",
        key: "kotlin.incremental",
        value: "true",
      });
    }

    return modConfig;
  });
};
*/

// -----------------------------------------------------------------------------
// [전략 1] Root build.gradle의 텍스트를 직접 치환하여 버전 강제 변경
// + 방법 1: KSP 플러그인 버전 명시적 설정
// 주석 처리: Node.js 22 설치 후 Kotlin 버전 강제 설정 불필요
// -----------------------------------------------------------------------------
/*
const withForcedRootKotlinVersion = (config: ExpoConfig) => {
  return withProjectBuildGradle(config, (modConfig) => {
    if (modConfig.modResults.language === "groovy") {
      let buildGradle = modConfig.modResults.contents;

      // 1. Kotlin 버전 강제 치환 (1.9.24 -> 1.9.25)
      if (buildGradle.includes("1.9.24")) {
        buildGradle = buildGradle.replace(/1\.9\.24/g, "1.9.25");
      }

      // 2. ext 블록에 kotlinVersion 강제 주입
      if (!buildGradle.includes('kotlinVersion = "1.9.25"')) {
        const extPattern = /buildscript\s*\{[\s\S]*?ext\s*\{/;
        if (extPattern.test(buildGradle)) {
          buildGradle = buildGradle.replace(
            extPattern,
            `buildscript {\n    ext {\n        kotlinVersion = "1.9.25"`
          );
        } else {
          buildGradle = buildGradle.replace(
            /buildscript\s*\{/,
            `buildscript {\n    ext {\n        kotlinVersion = "1.9.25"\n    }`
          );
        }
      }

      // 3. classpath 의존성도 1.9.25로 명시적 교체
      buildGradle = buildGradle.replace(
        /org\.jetbrains\.kotlin:kotlin-gradle-plugin:['"]?1\.9\.2\d['"]?/g,
        `org.jetbrains.kotlin:kotlin-gradle-plugin:1.9.25`
      );

      // 4. [NEW - 방법 1] KSP 플러그인 버전 명시적 설정
      // plugins 블록에서 KSP 버전 강제
      if (buildGradle.includes("plugins {") && buildGradle.includes("ksp")) {
        // plugins { id("com.google.devtools.ksp") version "..." } 형태
        buildGradle = buildGradle.replace(
          /id\s*\(['"]com\.google\.devtools\.ksp['"]\)\s*(?:version\s*['"][^'"]+['"])?/g,
          'id("com.google.devtools.ksp") version "1.9.25-1.0.20"'
        );
      }

      // 5. allprojects와 subprojects에 호환성 체크 무시 플래그 주입
      if (!buildGradle.includes("suppressKotlinVersionCompatibilityCheck")) {
        const allProjectsPattern = /allprojects\s*\{/;
        const suppressionLogic = `allprojects {
    // [NEW] 모든 서브프로젝트에서 Kotlin 플러그인 버전 강제
    buildscript {
        dependencies {
            classpath("org.jetbrains.kotlin:kotlin-gradle-plugin:1.9.25")
        }
    }
    
    tasks.withType(org.jetbrains.kotlin.gradle.tasks.KotlinCompile).configureEach {
        kotlinOptions {
            freeCompilerArgs += [
                "-P",
                "plugin:androidx.compose.compiler.plugins.kotlin:suppressKotlinVersionCompatibilityCheck=true"
            ]
        }
    }
`;
        buildGradle = buildGradle.replace(allProjectsPattern, suppressionLogic);

        // subprojects에도 추가
        const subProjectsPattern = /subprojects\s*\{/;
        if (!subProjectsPattern.test(buildGradle)) {
          buildGradle += `
subprojects {
    tasks.withType(org.jetbrains.kotlin.gradle.tasks.KotlinCompile).configureEach {
        kotlinOptions {
            freeCompilerArgs += [
                "-P",
                "plugin:androidx.compose.compiler.plugins.kotlin:suppressKotlinVersionCompatibilityCheck=true"
            ]
        }
    }
    
    afterEvaluate { project ->
        // expo-modules-core를 명시적으로 처리
        if (project.name == "expo-modules-core") {
            project.ext.kotlinVersion = "1.9.25"
            
            if (project.hasProperty("android")) {
                project.android {
                    buildFeatures {
                        compose = true
                    }
                    composeOptions {
                        kotlinCompilerExtensionVersion = "1.5.15"
                    }
                    kotlinOptions {
                        jvmTarget = "17"
                    }
                }
            }
        }
        
        // [NEW - 방법 1] 모든 Kotlin 및 KSP 의존성을 1.9.25로 강제
        project.configurations.all {
            resolutionStrategy.eachDependency { details ->
                if (details.requested.group == 'org.jetbrains.kotlin') {
                    if (details.requested.name == 'kotlin-gradle-plugin' || 
                        details.requested.name == 'kotlin-stdlib' ||
                        details.requested.name.startsWith('kotlin-')) {
                        details.useVersion "1.9.25"
                    }
                }
                // [NEW] KSP도 버전 강제
                if (details.requested.group == 'com.google.devtools.ksp') {
                    details.useVersion "1.9.25-1.0.20"
                }
            }
        }
        
        if (project.hasProperty("android")) {
            project.android {
                // composeOptions만 설정 (composeOptions가 있으면 자동으로 Compose 활성화)
                composeOptions {
                    kotlinCompilerExtensionVersion = "1.5.15"
                }
                kotlinOptions {
                    jvmTarget = "17"
                }
            }
        }
        
        project.ext.kotlinVersion = "1.9.25"
    }
}
          `;
        }
      }

      modConfig.modResults.contents = buildGradle;
    }
    return modConfig;
  });
};
*/

// -----------------------------------------------------------------------------
// [전략 2] expo-modules-core의 build.gradle 직접 수정 (안전장치)
// 여러 경로 가능성을 고려하여 개선
// 주석 처리: Node.js 22 설치 후 Kotlin 버전 강제 설정 불필요
// -----------------------------------------------------------------------------
/*
const withForcedKotlinInExpoModulesCore = (config: ExpoConfig) => {
  return withDangerousMod(config, [
    "android",
    async (config) => {
      const androidDir = config.modRequest.platformProjectRoot;

      // 더 많은 경로 시도
      const possiblePaths = [
        path.resolve(
          androidDir,
          "..",
          "node_modules",
          "expo-modules-core",
          "android",
          "build.gradle"
        ),
        path.resolve(
          androidDir,
          "../..",
          "node_modules",
          "expo-modules-core",
          "android",
          "build.gradle"
        ),
        path.resolve(
          androidDir,
          "../../..",
          "node_modules",
          "expo-modules-core",
          "android",
          "build.gradle"
        ),
        path.resolve(
          "/home/expo/workingdir/build",
          "node_modules",
          "expo-modules-core",
          "android",
          "build.gradle"
        ),
        path.resolve(
          "/home/expo/workingdir/build/packages/mobiles",
          "node_modules",
          "expo-modules-core",
          "android",
          "build.gradle"
        ),
      ];

      let expoModulesCoreBuildGradle: string | null = null;
      for (const possiblePath of possiblePaths) {
        if (fs.existsSync(possiblePath)) {
          expoModulesCoreBuildGradle = possiblePath;
          console.log(
            `[withDangerousMod] Found expo-modules-core at: ${possiblePath}`
          );
          break;
        }
      }

      if (expoModulesCoreBuildGradle) {
        let content = fs.readFileSync(expoModulesCoreBuildGradle, "utf-8");
        let modified = false;

        // 더 강력한 치환
        const originalContent = content;

        // 1. 모든 1.9.24를 1.9.25로 변경
        content = content.replace(/1\.9\.24/g, "1.9.25");
        if (content !== originalContent) modified = true;

        // 2. classpath 교체
        content = content.replace(
          /classpath\s*\(\s*["']org\.jetbrains\.kotlin:kotlin-gradle-plugin[^"']*["']\s*\)/g,
          'classpath("org.jetbrains.kotlin:kotlin-gradle-plugin:1.9.25")'
        );

        // 3. kotlinVersion 변수 교체 (모든 패턴)
        content = content.replace(
          /kotlinVersion\s*=\s*["']1\.9\.24["']/g,
          'kotlinVersion = "1.9.25"'
        );

        // 4. buildFeatures.compose = true 추가
        if (content.includes("android {")) {
          if (content.includes("buildFeatures {")) {
            if (!content.includes("compose = true")) {
              content = content.replace(
                /(buildFeatures\s*\{)/,
                "$1\n        compose = true"
              );
              modified = true;
            }
          } else {
            content = content.replace(
              /(android\s*\{)/,
              "$1\n    buildFeatures {\n        compose = true\n    }"
            );
            modified = true;
          }
        }

        // 5. composeOptions 강제 설정
        if (content.includes("android {")) {
          if (content.includes("composeOptions {")) {
            content = content.replace(
              /kotlinCompilerExtensionVersion\s*=\s*["'][^"']+["']/g,
              'kotlinCompilerExtensionVersion = "1.5.15"'
            );
            modified = true;
          } else {
            content = content.replace(
              /(buildFeatures\s*\{[^}]+\})/,
              '$1\n    composeOptions {\n        kotlinCompilerExtensionVersion = "1.5.15"\n    }'
            );
            if (!content.includes("composeOptions {")) {
              content = content.replace(
                /(android\s*\{)/,
                '$1\n    composeOptions {\n        kotlinCompilerExtensionVersion = "1.5.15"\n    }'
              );
            }
            modified = true;
          }
        }

        // 6. kotlinOptions.jvmTarget 추가
        if (content.includes("android {")) {
          if (content.includes("kotlinOptions {")) {
            if (!content.includes("jvmTarget")) {
              content = content.replace(
                /(kotlinOptions\s*\{)/,
                '$1\n            jvmTarget = "17"'
              );
              modified = true;
            } else {
              // 기존 jvmTarget을 17로 업데이트
              content = content.replace(
                /jvmTarget\s*=\s*["'][^"']+["']/g,
                'jvmTarget = "17"'
              );
              modified = true;
            }
          } else {
            content = content.replace(
              /(composeOptions\s*\{[^}]+\})/,
              '$1\n    kotlinOptions {\n        jvmTarget = "17"\n    }'
            );
            if (!content.includes("kotlinOptions {")) {
              content = content.replace(
                /(android\s*\{)/,
                '$1\n    kotlinOptions {\n        jvmTarget = "17"\n    }'
              );
            }
            modified = true;
          }
        }

        if (modified) {
          fs.writeFileSync(expoModulesCoreBuildGradle, content, "utf-8");
          console.log(
            `[withDangerousMod] ✅ Patched: ${expoModulesCoreBuildGradle}`
          );
        }
      } else {
        console.warn(
          "[withDangerousMod] ⚠️ expo-modules-core build.gradle not found"
        );
      }

      return config;
    },
  ]);
};
*/

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
      icon: "./assets/icon-v2.png",
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
          foregroundImage: "./assets/adaptive-icon-final.png",
          backgroundColor: "#ffffff",
        },
        package: "com.mp3.mobiles",
      },
      plugins: [
        // 주석 처리: Node.js 22 설치 후 Kotlin 버전 강제 설정 불필요
        /*
        [
          "expo-build-properties",
          {
            android: {
              kotlinVersion: "1.9.25",
            },
          },
        ],
        */
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

  // 세 가지 전략 모두 적용
  // 주석 처리: Node.js 22 설치 후 Kotlin 버전 강제 설정 불필요
  let finalConfig = baseConfig as ExpoConfig;
  // finalConfig = withKotlinGradleProperty(finalConfig);
  // finalConfig = withForcedRootKotlinVersion(finalConfig);
  // finalConfig = withForcedKotlinInExpoModulesCore(finalConfig);
  return finalConfig;
};
