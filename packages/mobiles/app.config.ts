/**
 * Expo 앱 설정 파일
 * Root build.gradle의 Kotlin 버전을 1.9.25로 강제 치환하는 전략
 */
import { ExpoConfig, ConfigContext } from "expo/config";
import { withProjectBuildGradle, withDangerousMod } from "expo/config-plugins";
import * as fs from "fs";
import * as path from "path";

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

        // 1.9.24를 모두 1.9.25로 변경
        content = content.replace(/1\.9\.24/g, "1.9.25");

        // classpath 교체
        content = content.replace(
          /classpath\s*\(\s*["']org\.jetbrains\.kotlin:kotlin-gradle-plugin[^"']*["']\s*\)/g,
          'classpath("org.jetbrains.kotlin:kotlin-gradle-plugin:1.9.25")'
        );

        // composeOptions 추가
        if (content.includes("android {") && !content.includes("composeOptions")) {
          const compileOptionsPattern = /(compileOptions\s*\{[^}]+\})/s;
          if (compileOptionsPattern.test(content)) {
            content = content.replace(
              compileOptionsPattern,
              `$1\n    composeOptions { kotlinCompilerExtensionVersion = "1.5.15" }`
            );
          } else {
            content = content.replace(
              /android\s*\{/,
              'android {\n    composeOptions {\n        kotlinCompilerExtensionVersion = "1.5.15"\n    }'
            );
          }
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

  // 두 가지 전략 모두 적용
  let finalConfig = withForcedRootKotlinVersion(baseConfig as ExpoConfig);
  finalConfig = withForcedKotlinInExpoModulesCore(finalConfig);
  return finalConfig;
};
