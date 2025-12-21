// 주석 처리: Node.js 22 설치 후 Kotlin 버전 강제 설정 불필요
// 전체 파일이 주석 처리되었습니다. 필요시 주석을 제거하여 활성화할 수 있습니다.

/*
const fs = require("fs");
const path = require("path");

console.log("🔧 [POSTINSTALL] Fixing Kotlin version in ALL expo-modules-core...");
console.log("📂 Current working directory:", process.cwd());
console.log("📂 Script directory:", __dirname);

const packageRoot = __dirname.replace(/[\\/]scripts$/, "");
const workspaceRoot = path.resolve(packageRoot, "../..");

console.log("📂 Package root:", packageRoot);
console.log("📂 Workspace root:", workspaceRoot);

// 모든 가능한 경로
const searchPaths = [
  path.join(packageRoot, "node_modules"),
  path.join(workspaceRoot, "node_modules"),
  path.join(workspaceRoot, "packages", "mobiles", "node_modules"),
];

function findExpoModulesCoreBuildGradle() {
  const found = [];
  
  searchPaths.forEach(basePath => {
    if (!fs.existsSync(basePath)) return;
    
    const expoModulesCorePath = path.join(
      basePath,
      "expo-modules-core",
      "android",
      "build.gradle"
    );
    
    if (fs.existsSync(expoModulesCorePath)) {
      found.push(expoModulesCorePath);
    }
  });
  
  return found;
}

const buildGradleFiles = findExpoModulesCoreBuildGradle();

if (buildGradleFiles.length === 0) {
  console.warn("⚠️ expo-modules-core build.gradle not found");
  console.warn("   Searched paths:");
  searchPaths.forEach(p => {
    const exists = fs.existsSync(p) ? "✅ EXISTS" : "❌ NOT FOUND";
    console.warn(`     - ${p} (${exists})`);
  });
  console.warn("   This is normal if expo-modules-core is not installed yet.");
  console.warn("   The postinstall script will run again after npm install completes.");
  process.exit(0);
}

console.log(`📦 Found ${buildGradleFiles.length} expo-modules-core build.gradle file(s)`);

buildGradleFiles.forEach((filePath, index) => {
  console.log(`\n[${index + 1}/${buildGradleFiles.length}] Processing: ${filePath}`);
  
  let content = fs.readFileSync(filePath, "utf8");
  const originalContent = content;
  let modified = false;

  // 1. 모든 1.9.24를 1.9.25로 변경 (가장 먼저)
  if (content.includes("1.9.24")) {
    content = content.replace(/1\.9\.24/g, "1.9.25");
    modified = true;
    console.log("  ✅ Replaced all 1.9.24 -> 1.9.25");
  }

  // 2. buildscript classpath에서 Kotlin 버전 강제 교체
  const classpathPattern = /classpath\s*\(\s*["']org\.jetbrains\.kotlin:kotlin-gradle-plugin[^"']*["']\s*\)/g;
  const newClasspath = 'classpath("org.jetbrains.kotlin:kotlin-gradle-plugin:1.9.25")';
  if (classpathPattern.test(content)) {
    content = content.replace(classpathPattern, newClasspath);
    modified = true;
    console.log("  ✅ Updated buildscript classpath to Kotlin 1.9.25");
  }

  // 3. ext 블록의 kotlinVersion 변수 교체
  const kotlinVersionPatterns = [
    /kotlinVersion\s*=\s*["']1\.9\.24["']/g,
    /kotlinVersion\s*=\s*"1\.9\.24"/g,
    /kotlinVersion\s*=\s*'1\.9\.24'/g,
    /kotlinVersion\s*=\s*project\.ext\.kotlinVersion\s*\|\|\s*["']1\.9\.24["']/g,
  ];
  
  kotlinVersionPatterns.forEach(pattern => {
    if (pattern.test(content)) {
      content = content.replace(pattern, 'kotlinVersion = "1.9.25"');
      modified = true;
      console.log("  ✅ Updated kotlinVersion variable to 1.9.25");
    }
  });

  // 4. buildFeatures.compose = true 추가
  if (content.includes("android {")) {
    if (content.includes("buildFeatures {")) {
      if (!content.includes("compose = true")) {
        content = content.replace(
          /(buildFeatures\s*\{)/,
          '$1\n        compose = true'
        );
        modified = true;
        console.log("  ✅ Added compose = true to buildFeatures");
      }
    } else {
      // buildFeatures가 없으면 추가
      content = content.replace(
        /(android\s*\{)/,
        '$1\n    buildFeatures {\n        compose = true\n    }'
      );
      modified = true;
      console.log("  ✅ Added buildFeatures { compose = true }");
    }
  }

  // 5. Compose Compiler 버전 강제 설정
  if (content.includes("android {")) {
    // composeOptions가 이미 있는 경우
    if (content.includes("composeOptions {")) {
      // 기존 버전을 1.5.15로 교체
      const composeVersionPattern = /kotlinCompilerExtensionVersion\s*=\s*["'][^"']+["']/g;
      if (composeVersionPattern.test(content)) {
        content = content.replace(
          composeVersionPattern,
          'kotlinCompilerExtensionVersion = "1.5.15"'
        );
        modified = true;
        console.log("  ✅ Updated Compose Compiler version to 1.5.15");
      }
    } else {
      // composeOptions가 없으면 추가
      const androidBlockPattern = /(android\s*\{[^}]*?)(compileOptions\s*\{[^}]+\})/s;
      if (androidBlockPattern.test(content)) {
        content = content.replace(
          androidBlockPattern,
          '$1$2\n    composeOptions {\n        kotlinCompilerExtensionVersion = "1.5.15"\n    }'
        );
        modified = true;
        console.log("  ✅ Added Compose Compiler 1.5.15");
      } else {
        // buildFeatures 다음에 추가
        if (content.includes("buildFeatures {")) {
          content = content.replace(
            /(buildFeatures\s*\{[^}]+\})/,
            '$1\n    composeOptions {\n        kotlinCompilerExtensionVersion = "1.5.15"\n    }'
          );
          modified = true;
          console.log("  ✅ Added Compose Compiler 1.5.15 after buildFeatures");
        } else {
          // android 블록 바로 다음에 추가
          content = content.replace(
            /(android\s*\{)/,
            '$1\n    composeOptions {\n        kotlinCompilerExtensionVersion = "1.5.15"\n    }'
          );
          modified = true;
          console.log("  ✅ Injected Compose Compiler 1.5.15 in android block");
        }
      }
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
        console.log("  ✅ Added jvmTarget = 17 to kotlinOptions");
      } else {
        // 기존 jvmTarget을 17로 업데이트
        content = content.replace(
          /jvmTarget\s*=\s*["'][^"']+["']/g,
          'jvmTarget = "17"'
        );
        modified = true;
        console.log("  ✅ Updated jvmTarget to 17");
      }
    } else {
      // kotlinOptions가 없으면 추가
      if (content.includes("composeOptions {")) {
        content = content.replace(
          /(composeOptions\s*\{[^}]+\})/,
          '$1\n    kotlinOptions {\n        jvmTarget = "17"\n    }'
        );
        modified = true;
        console.log("  ✅ Added kotlinOptions { jvmTarget = 17 } after composeOptions");
      } else {
        content = content.replace(
          /(android\s*\{)/,
          '$1\n    kotlinOptions {\n        jvmTarget = "17"\n    }'
        );
        modified = true;
        console.log("  ✅ Added kotlinOptions { jvmTarget = 17 } in android block");
      }
    }
  }

  // 7. ext 블록에 kotlinVersion 강제 추가 (없는 경우)
  if (!content.includes('kotlinVersion = "1.9.25"') && content.includes("ext {")) {
    content = content.replace(
      /(ext\s*\{)/,
      '$1\n    kotlinVersion = "1.9.25"'
    );
    modified = true;
    console.log("  ✅ Added kotlinVersion to ext block");
  }

  if (modified) {
    fs.writeFileSync(filePath, content, "utf8");
    console.log(`  ✅ Successfully patched: ${filePath}`);
    
    // 패치 후 내용 확인 (처음 500자만)
    const verifyContent = fs.readFileSync(filePath, "utf8");
    const kotlinMatches = verifyContent.match(/kotlin.*1\.9\.\d+/gi);
    if (kotlinMatches) {
      console.log(`  📋 Found Kotlin versions in file: ${kotlinMatches.slice(0, 5).join(", ")}`);
    }
  } else {
    console.log("  ℹ️  No changes needed (already patched)");
    
    // 이미 패치된 경우에도 확인
    const verifyContent = fs.readFileSync(filePath, "utf8");
    if (verifyContent.includes("1.9.25")) {
      console.log("  ✅ Confirmed: Kotlin 1.9.25 is already set");
    } else if (verifyContent.includes("1.9.24")) {
      console.warn("  ⚠️  WARNING: Still contains 1.9.24! Pattern matching may need adjustment.");
    }
  }
});

console.log("\n🔧 [POSTINSTALL] Kotlin fix complete!");
console.log("📝 Summary:");
console.log(`   - Processed ${buildGradleFiles.length} file(s)`);
console.log("   - All expo-modules-core build.gradle files should now use Kotlin 1.9.25");
*/
