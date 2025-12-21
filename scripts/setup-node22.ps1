# Node.js 22 설치 후 실행할 스크립트
# 이 스크립트는 Node.js 22 설치 후 node_modules 재설치 및 문제 해결을 수행합니다.

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "Node.js 22 설치 후 설정 스크립트" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

# Node.js 버전 확인
$nodeVersion = node --version
Write-Host "현재 Node.js 버전: $nodeVersion" -ForegroundColor Yellow

if ($nodeVersion -notmatch "v22\.") {
    Write-Host "경고: Node.js 22가 아닙니다. Node.js 22를 설치해주세요." -ForegroundColor Red
    Write-Host "설치 방법:" -ForegroundColor Yellow
    Write-Host "  1. https://nodejs.org/ko/download/ 에서 Windows Installer 다운로드" -ForegroundColor White
    Write-Host "  2. 또는 nvm-windows 사용: https://github.com/coreybutler/nvm-windows/releases" -ForegroundColor White
    exit 1
}

Write-Host "✓ Node.js 22 확인 완료" -ForegroundColor Green
Write-Host ""

# 프로젝트 루트로 이동
$projectRoot = Split-Path -Parent $PSScriptRoot
Set-Location $projectRoot

Write-Host "프로젝트 루트: $projectRoot" -ForegroundColor Cyan
Write-Host ""

# 1. node_modules 삭제
Write-Host "1. 기존 node_modules 삭제 중..." -ForegroundColor Yellow
if (Test-Path "node_modules") {
    Remove-Item -Recurse -Force "node_modules"
    Write-Host "   ✓ 루트 node_modules 삭제 완료" -ForegroundColor Green
}

# 각 패키지의 node_modules도 삭제
$packages = @("packages/common", "packages/functions", "packages/web-cms", "packages/mobiles")
foreach ($package in $packages) {
    $packagePath = Join-Path $projectRoot $package
    $nodeModulesPath = Join-Path $packagePath "node_modules"
    if (Test-Path $nodeModulesPath) {
        Remove-Item -Recurse -Force $nodeModulesPath
        Write-Host "   ✓ $package/node_modules 삭제 완료" -ForegroundColor Green
    }
}

Write-Host ""

# 2. package-lock.json 삭제 (선택사항)
Write-Host "2. package-lock.json 삭제 중..." -ForegroundColor Yellow
if (Test-Path "package-lock.json") {
    Remove-Item -Force "package-lock.json"
    Write-Host "   ✓ package-lock.json 삭제 완료" -ForegroundColor Green
}
Write-Host ""

# 3. npm 캐시 정리
Write-Host "3. npm 캐시 정리 중..." -ForegroundColor Yellow
npm cache clean --force
Write-Host "   ✓ npm 캐시 정리 완료" -ForegroundColor Green
Write-Host ""

# 4. 의존성 재설치
Write-Host "4. 의존성 재설치 중..." -ForegroundColor Yellow
Write-Host "   이 작업은 시간이 걸릴 수 있습니다..." -ForegroundColor Gray
npm install
if ($LASTEXITCODE -ne 0) {
    Write-Host "   ✗ npm install 실패" -ForegroundColor Red
    exit 1
}
Write-Host "   ✓ 의존성 설치 완료" -ForegroundColor Green
Write-Host ""

# 5. 각 패키지별 설치
Write-Host "5. 각 패키지별 의존성 설치 중..." -ForegroundColor Yellow
foreach ($package in $packages) {
    $packagePath = Join-Path $projectRoot $package
    if (Test-Path (Join-Path $packagePath "package.json")) {
        Write-Host "   $package 설치 중..." -ForegroundColor Gray
        Set-Location $packagePath
        npm install
        if ($LASTEXITCODE -ne 0) {
            Write-Host "   ✗ $package 설치 실패" -ForegroundColor Red
        } else {
            Write-Host "   ✓ $package 설치 완료" -ForegroundColor Green
        }
        Set-Location $projectRoot
    }
}
Write-Host ""

# 6. 네이티브 모듈 재빌드 확인
Write-Host "6. 네이티브 모듈 확인 중..." -ForegroundColor Yellow
Write-Host "   React Native 및 Expo 관련 네이티브 모듈이 자동으로 재빌드됩니다." -ForegroundColor Gray
Write-Host ""

# 7. 완료 메시지
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "설정 완료!" -ForegroundColor Green
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "다음 단계:" -ForegroundColor Yellow
Write-Host "  1. Metro bundler 테스트: cd packages/mobiles && npm start" -ForegroundColor White
Write-Host "  2. 빌드 테스트: eas build --platform android --profile preview" -ForegroundColor White
Write-Host "  3. Firebase Functions 테스트: npm run serve:functions" -ForegroundColor White
Write-Host ""





