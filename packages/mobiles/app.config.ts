/**
 * Expo 앱 설정 파일
 * Root build.gradle의 Kotlin 버전을 1.9.25로 강제 치환하는 전략
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
// [전략 1] Root build.gradle의 텍스트를 직접 치환하여 버전 강제 변경
// -----------------------------------------------------------------------------
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
          // ext 블록이 없으면 추가
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

      // 4. allprojects와 subprojects에 호환성 체크 무시 플래그 주입
      if (!buildGradle.includes("suppressKotlinVersionCompatibilityCheck")) {
        const allProjectsPattern = /allprojects\s*\{/;
        const suppressionLogic = `allprojects {
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

        // subprojects에도 추가 (expo-modules-core 등 하위 모듈용)
        const subProjectsPattern = /subprojects\s*\{/;
        if (!subProjectsPattern.test(buildGradle)) {
          // subprojects 블록이 없으면 추가
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
                    composeOptions {
                        kotlinCompilerExtensionVersion = "1.5.15"
                    }
                }
            }
        }
        
        // 모든 Kotlin 의존성을 1.9.25로 강제
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
        
        if (project.hasProperty("android")) {
            project.android {
                composeOptions {
                    kotlinCompilerExtensionVersion = "1.5.15"
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

// -----------------------------------------------------------------------------
// [전략 2] expo-modules-core의 build.gradle 직접 수정 (안전장치)
// 여러 경로 가능성을 고려하여 개선
// -----------------------------------------------------------------------------
const withForcedKotlinInExpoModulesCore = (config: ExpoConfig) => {
  return withDangerousMod(config, [
    "android",
    async (config) => {
      const androidDir = config.modRequest.platformProjectRoot;

      // 여러 가능한 경로 시도
      const possiblePaths = [
        // 경로 1: packages/mobiles/node_modules (로컬)
        path.resolve(
          androidDir,
          "..",
          "node_modules",
          "expo-modules-core",
          "android",
          "build.gradle"
        ),
        // 경로 2: 루트 node_modules (monorepo)
        path.resolve(
          androidDir,
          "../..",
          "node_modules",
          "expo-modules-core",
          "android",
          "build.gradle"
        ),
        // 경로 3: EAS 빌드 환경 (절대 경로)
        path.resolve(
          "/home/expo/workingdir/build",
          "node_modules",
          "expo-modules-core",
          "android",
          "build.gradle"
        ),
        // 경로 4: EAS 빌드 환경 (상대 경로)
        path.resolve(
          androidDir,
          "../../..",
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
          break;
        }
      }

      if (expoModulesCoreBuildGradle) {
        let content = fs.readFileSync(expoModulesCoreBuildGradle, "utf-8");
        let modified = false;

        // 1.9.24를 모두 1.9.25로 변경
        if (content.includes("1.9.24")) {
          content = content.replace(/1\.9\.24/g, "1.9.25");
          modified = true;
        }

        // classpath 교체
        const originalClasspath = content;
        content = content.replace(
          /classpath\s*\(\s*["']org\.jetbrains\.kotlin:kotlin-gradle-plugin[^"']*["']\s*\)/g,
          'classpath("org.jetbrains.kotlin:kotlin-gradle-plugin:1.9.25")'
        );
        if (content !== originalClasspath) {
          modified = true;
        }

        // kotlinVersion 변수 교체
        if (content.includes("kotlinVersion")) {
          const originalKotlinVersion = content;
          content = content.replace(
            /kotlinVersion\s*=\s*["']1\.9\.24["']/g,
            'kotlinVersion = "1.9.25"'
          );
          if (content !== originalKotlinVersion) {
            modified = true;
          }
        }

        // composeOptions 추가/업데이트
        if (
          content.includes("android {") &&
          !content.includes('kotlinCompilerExtensionVersion = "1.5.15"')
        ) {
          if (content.includes("composeOptions {")) {
            content = content.replace(
              /kotlinCompilerExtensionVersion\s*=\s*["'][^"']+["']/g,
              'kotlinCompilerExtensionVersion = "1.5.15"'
            );
            modified = true;
          } else {
            const compileOptionsPattern = /(compileOptions\s*\{[^}]+\})/s;
            if (compileOptionsPattern.test(content)) {
              content = content.replace(
                compileOptionsPattern,
                `$1\n    composeOptions { kotlinCompilerExtensionVersion = "1.5.15" }`
              );
              modified = true;
            } else {
              content = content.replace(
                /android\s*\{/,
                'android {\n    composeOptions {\n        kotlinCompilerExtensionVersion = "1.5.15"\n    }'
              );
              modified = true;
            }
          }
        }

        if (modified) {
          fs.writeFileSync(expoModulesCoreBuildGradle, content, "utf-8");
          console.log(
            `✅ Patched expo-modules-core build.gradle at: ${expoModulesCoreBuildGradle}`
          );
        }
      } else {
        console.warn(
          "⚠️ expo-modules-core build.gradle not found in any expected location"
        );
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
  let finalConfig = withKotlinGradleProperty(baseConfig as ExpoConfig);
  finalConfig = withForcedRootKotlinVersion(finalConfig);
  finalConfig = withForcedKotlinInExpoModulesCore(finalConfig);
  return finalConfig;
};
