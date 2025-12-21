/**
 * Expo CLI의 getNativeModuleVersionsAsync 함수 수정
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
  // mobiles node_modules
  path.join(__dirname, '../node_modules/expo/node_modules/@expo/cli/src/api/getNativeModuleVersions.ts'),
  path.join(__dirname, '../node_modules/expo/node_modules/@expo/cli/build/api/getNativeModuleVersions.js'),
  // @expo/cli 직접 설치된 경우
  path.join(__dirname, '../node_modules/@expo/cli/src/api/getNativeModuleVersions.ts'),
  path.join(__dirname, '../../node_modules/@expo/cli/src/api/getNativeModuleVersions.ts'),
  path.join(__dirname, '../../node_modules/@expo/cli/build/api/getNativeModuleVersions.js'),
];

// 재귀적으로 파일 찾기 함수
function findFile(startPath, fileName) {
  if (!fs.existsSync(startPath)) return null;
  
  try {
    const files = fs.readdirSync(startPath);
    for (const file of files) {
      const filePath = path.join(startPath, file);
      const stat = fs.statSync(filePath);
      
      if (stat.isDirectory() && !file.startsWith('.') && file !== 'node_modules') {
        const found = findFile(filePath, fileName);
        if (found) return found;
      } else if (stat.isFile() && file === fileName) {
        return filePath;
      }
    }
  } catch (err) {
    // 권한 오류 등 무시
  }
  return null;
}

let targetFile = null;

// 파일 찾기 - 먼저 가능한 경로 확인
for (const filePath of possiblePaths) {
  if (fs.existsSync(filePath)) {
    targetFile = filePath;
    console.log(`Found file at: ${filePath}`);
    break;
  }
}

// 파일을 찾지 못한 경우 재귀적으로 검색
if (!targetFile) {
  const searchPaths = [
    path.join(__dirname, '../../node_modules'),
    path.join(__dirname, '../node_modules'),
  ];
  
  for (const searchPath of searchPaths) {
    if (fs.existsSync(searchPath)) {
      targetFile = findFile(searchPath, 'getNativeModuleVersions.ts');
      if (targetFile) {
        console.log(`Found file by search at: ${targetFile}`);
        break;
      }
    }
  }
}

if (!targetFile) {
  console.log('Warning: getNativeModuleVersions.ts file not found. Skipping fix.');
  console.log('This is normal if expo is not installed yet.');
  process.exit(0);
}

try {
  // 파일 읽기
  let content = fs.readFileSync(targetFile, 'utf8');
  const originalContent = content;

  // 수정: Response.json() 호출 전에 clone() 추가
  // 문제: Node.js 22의 undici에서 Response body를 한 번만 읽을 수 있음
  // 해결: response.clone()을 사용하여 복제본 생성 후 사용
  
  // 패턴 1: getNativeModuleVersionsAsync 함수 내부 수정
  // 함수 시작부터 response.json() 호출까지 찾기
  const functionRegex = /(export\s+async\s+function\s+getNativeModuleVersionsAsync\([^)]*\)\s*\{[\s\S]*?)(const\s+response\s*=\s*await\s+fetch\([^)]+\)[^;]*;)/;
  
  if (functionRegex.test(content)) {
    // response 변수 선언 후 clone() 추가
    content = content.replace(
      /(const\s+response\s*=\s*await\s+fetch\([^)]+\)[^;]*;)/,
      '$1\n  const clonedResponse = response.clone();'
    );
    
    // response.json()을 clonedResponse.json()으로 변경
    content = content.replace(
      /(\s+)await\s+response\.json\(\)/g,
      '$1await clonedResponse.json()'
    );
    
    // return await response.json() 패턴
    content = content.replace(
      /(\s+)return\s+await\s+response\.json\(\)/g,
      '$1return await clonedResponse.json()'
    );
  } else {
    // 함수 패턴을 찾지 못한 경우, 일반적인 패턴으로 수정
    // response.json()이 있는 모든 곳에 clone() 추가 시도
    if (content.includes('await response.json()') && !content.includes('response.clone()')) {
      // response 선언 찾기
      const responseDeclRegex = /(const\s+response\s*=\s*await\s+fetch[^;]+;)/;
      if (responseDeclRegex.test(content)) {
        content = content.replace(
          responseDeclRegex,
          '$1\n  const clonedResponse = response.clone();'
        );
        // 모든 response.json()을 clonedResponse.json()으로 변경
        content = content.replace(/response\.json\(\)/g, 'clonedResponse.json()');
      }
    }
  }

  // 변경사항이 있으면 파일 저장
  if (content !== originalContent) {
    fs.writeFileSync(targetFile, content, 'utf8');
    console.log('✅ Successfully fixed getNativeModuleVersions.ts');
    console.log('   Fixed Response.json() body reuse issue for Node.js 22 compatibility');
  } else {
    console.log('ℹ️  No changes needed. File may already be fixed or pattern not found.');
    console.log('   File content preview:');
    console.log(content.substring(0, 500));
  }
} catch (error) {
  console.error('❌ Error fixing file:', error.message);
  process.exit(1);
}

