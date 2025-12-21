/**
 * Expo CLI의 getNativeModuleVersionsAsync 함수를 런타임에 패치
 * Node.js 22의 undici와의 호환성 문제 해결
 * 
 * 이 스크립트는 expo start 전에 실행되어 문제를 해결합니다.
 */

const fs = require('fs');
const path = require('path');

// 가능한 파일 경로들 (TypeScript와 JavaScript 모두)
const possiblePaths = [
  // TypeScript 소스
  path.join(__dirname, '../../node_modules/expo/node_modules/@expo/cli/src/api/getNativeModuleVersions.ts'),
  // JavaScript 컴파일된 파일
  path.join(__dirname, '../../node_modules/expo/node_modules/@expo/cli/build/api/getNativeModuleVersions.js'),
  path.join(__dirname, '../../node_modules/expo/node_modules/@expo/cli/lib/api/getNativeModuleVersions.js'),
  // 다른 가능한 위치
  path.join(__dirname, '../../node_modules/@expo/cli/src/api/getNativeModuleVersions.ts'),
  path.join(__dirname, '../../node_modules/@expo/cli/build/api/getNativeModuleVersions.js'),
  path.join(__dirname, '../../node_modules/@expo/cli/lib/api/getNativeModuleVersions.js'),
];

// 재귀적으로 파일 찾기
function findFile(startPath, fileName) {
  if (!fs.existsSync(startPath)) return null;
  
  try {
    const files = fs.readdirSync(startPath);
    for (const file of files) {
      const filePath = path.join(startPath, file);
      const stat = fs.statSync(filePath);
      
      if (stat.isDirectory() && !file.startsWith('.') && file !== 'node_modules' && file !== '.git') {
        const found = findFile(filePath, fileName);
        if (found) return found;
      } else if (stat.isFile() && file.includes(fileName)) {
        return filePath;
      }
    }
  } catch (err) {
    // 권한 오류 등 무시
  }
  return null;
}

let targetFile = null;

// 파일 찾기
for (const filePath of possiblePaths) {
  if (fs.existsSync(filePath)) {
    targetFile = filePath;
    console.log(`✅ Found file at: ${filePath}`);
    break;
  }
}

// 재귀 검색
if (!targetFile) {
  const searchPaths = [
    path.join(__dirname, '../../node_modules'),
  ];
  
  for (const searchPath of searchPaths) {
    if (fs.existsSync(searchPath)) {
      targetFile = findFile(searchPath, 'getNativeModuleVersions');
      if (targetFile) {
        console.log(`✅ Found file by search at: ${targetFile}`);
        break;
      }
    }
  }
}

if (!targetFile) {
  console.log('⚠️  Warning: getNativeModuleVersions file not found.');
  console.log('   The fix will be applied at runtime if the file exists.');
  console.log('   This is normal if expo is not installed yet or using a different structure.');
  process.exit(0);
}

try {
  let content = fs.readFileSync(targetFile, 'utf8');
  const originalContent = content;
  let modified = false;

  // 패턴 1: export async function getNativeModuleVersionsAsync
  // response.json() 호출 전에 clone() 추가
  const functionPattern = /(export\s+(async\s+)?function\s+getNativeModuleVersionsAsync\s*\([^)]*\)\s*\{[\s\S]*?)(const\s+response\s*=\s*await\s+fetch\([^)]+\)[^;]*;)/;
  
  if (functionPattern.test(content)) {
    // response 선언 후 clone() 추가
    content = content.replace(
      /(const\s+response\s*=\s*await\s+fetch\([^)]+\)[^;]*;)/,
      '$1\n  const clonedResponse = response.clone();'
    );
    modified = true;
    
    // response.json()을 clonedResponse.json()으로 변경
    const jsonPattern = /(\s+)(await\s+)?response\.json\(\)/g;
    if (jsonPattern.test(content)) {
      content = content.replace(jsonPattern, (match, indent, awaitKeyword) => {
        return `${indent}${awaitKeyword || ''}clonedResponse.json()`;
      });
      modified = true;
    }
  } else {
    // 함수 패턴을 찾지 못한 경우, 일반적인 패턴으로 수정
    if (content.includes('response.json()') && !content.includes('response.clone()')) {
      // response 선언 찾기
      const responseDeclPattern = /(const\s+response\s*=\s*await\s+fetch[^;]+;)/;
      if (responseDeclPattern.test(content)) {
        content = content.replace(
          responseDeclPattern,
          '$1\n  const clonedResponse = response.clone();'
        );
        // 모든 response.json()을 clonedResponse.json()으로 변경
        content = content.replace(/response\.json\(\)/g, 'clonedResponse.json()');
        modified = true;
      }
    }
  }

  if (modified && content !== originalContent) {
    fs.writeFileSync(targetFile, content, 'utf8');
    console.log('✅ Successfully patched getNativeModuleVersions file');
    console.log(`   File: ${targetFile}`);
    console.log('   Fixed Response.json() body reuse issue for Node.js 22 compatibility');
  } else if (!modified) {
    console.log('ℹ️  File may already be patched or pattern not found.');
  }
} catch (error) {
  console.error('❌ Error patching file:', error.message);
  process.exit(1);
}



