// packages/mobiles/scripts/fix-kotlin.js
const fs = require("fs");
const path = require("path");

console.log("🔧 Fixing Kotlin version in node_modules...");

// 모노레포 구조 고려: 현재 패키지의 node_modules와 루트의 node_modules 모두 확인
const currentDir = __dirname;
const packageRoot = path.resolve(currentDir, "..");
const workspaceRoot = path.resolve(packageRoot, "../..");

// 1. packages/mobiles/node_modules 확인
let modulesCorePath = path.join(
  packageRoot,
  "node_modules",
  "expo-modules-core",
  "android",
  "build.gradle"
);

// 2. 루트 node_modules 확인 (모노레포에서 의존성이 루트에 설치될 수 있음)
if (!fs.existsSync(modulesCorePath)) {
  modulesCorePath = path.join(
    workspaceRoot,
    "node_modules",
    "expo-modules-core",
    "android",
    "build.gradle"
  );
}

if (fs.existsSync(modulesCorePath)) {
  let content = fs.readFileSync(modulesCorePath, "utf8");
  let modified = false;

  // 1. 1.9.24를 1.9.25로 무조건 치환 (모든 곳)
  if (content.includes("1.9.24")) {
    content = content.replace(/1\.9\.24/g, "1.9.25");
    modified = true;
    console.log("✅ Updated Kotlin 1.9.24 -> 1.9.25 in expo-modules-core");
  }

  // 2. buildscript classpath에서 Kotlin 버전 강제 교체
  const originalClasspath = content;
  content = content.replace(
    /classpath\s*\(\s*["']org\.jetbrains\.kotlin:kotlin-gradle-plugin[^"']*["']\s*\)/g,
    'classpath("org.jetbrains.kotlin:kotlin-gradle-plugin:1.9.25")'
  );
  if (content !== originalClasspath) {
    modified = true;
    console.log("✅ Updated buildscript classpath to Kotlin 1.9.25");
  }

  // 3. kotlinVersion 변수 강제 교체
  const kotlinVersionPattern = /kotlinVersion\s*=\s*.*$/gm;
  if (kotlinVersionPattern.test(content)) {
    const originalKotlinVersion = content;
    content = content.replace(kotlinVersionPattern, 'kotlinVersion = "1.9.25"');
    if (content !== originalKotlinVersion) {
      modified = true;
      console.log("✅ Updated kotlinVersion variable to 1.9.25");
    }
  }

  // 4. Compose Compiler 버전도 1.5.15로 고정
  if (!content.includes('kotlinCompilerExtensionVersion = "1.5.15"')) {
    if (content.includes("composeOptions {")) {
      content = content.replace(
        /kotlinCompilerExtensionVersion\s*=\s*['"][^'"]+['"]/g,
        'kotlinCompilerExtensionVersion = "1.5.15"'
      );
      modified = true;
      console.log("✅ Updated Compose Compiler version to 1.5.15");
    } else if (content.includes("android {")) {
      // android 블록 안에 composeOptions 주입
      const androidPattern = /(android\s*\{[^}]*?)(\})/s;
      if (androidPattern.test(content)) {
        content = content.replace(
          androidPattern,
          '$1\n    composeOptions {\n        kotlinCompilerExtensionVersion = "1.5.15"\n    }\n$2'
        );
        modified = true;
        console.log("✅ Injected Compose Compiler 1.5.15 in expo-modules-core");
      } else {
        // 간단한 패턴으로 시도
        content = content.replace(
          /android\s*\{/,
          'android {\n    composeOptions {\n        kotlinCompilerExtensionVersion = "1.5.15"\n    }'
        );
        modified = true;
        console.log("✅ Injected Compose Compiler 1.5.15 in expo-modules-core");
      }
    }
  }

  if (modified) {
    fs.writeFileSync(modulesCorePath, content, "utf8");
    console.log("✅ Successfully patched expo-modules-core build.gradle");
  } else {
    console.log("ℹ️ No changes needed in expo-modules-core");
  }
} else {
  console.warn(
    "⚠️ expo-modules-core build.gradle not found at:",
    modulesCorePath
  );
  console.warn("   This is normal if expo-modules-core is not installed yet.");
}

console.log("🔧 Kotlin fix complete.");
