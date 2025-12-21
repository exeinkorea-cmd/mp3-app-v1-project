# 캐시 삭제 및 서버 재시작 스크립트
# Node.js 22 설치 후 모든 캐시 정리 및 서버 재시작

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "캐시 삭제 및 서버 재시작 스크립트" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

$projectRoot = Split-Path -Parent $PSScriptRoot
if (-not $projectRoot) {
    $projectRoot = Get-Location
}

Write-Host "프로젝트 루트: $projectRoot" -ForegroundColor Yellow
Write-Host ""

# 1. 실행 중인 프로세스 종료
Write-Host "1. 실행 중인 서버 프로세스 종료 중..." -ForegroundColor Yellow
$processes = @("node", "expo", "metro", "react-native")
foreach ($proc in $processes) {
    $running = Get-Process -Name $proc -ErrorAction SilentlyContinue
    if ($running) {
        Write-Host "   종료 중: $proc" -ForegroundColor Gray
        Stop-Process -Name $proc -Force -ErrorAction SilentlyContinue
        Start-Sleep -Seconds 1
    }
}
Write-Host "   ✓ 프로세스 종료 완료" -ForegroundColor Green
Write-Host ""

# 2. npm 캐시 정리
Write-Host "2. npm 캐시 정리 중..." -ForegroundColor Yellow
npm cache clean --force
Write-Host "   ✓ npm 캐시 정리 완료" -ForegroundColor Green
Write-Host ""

# 3. Metro 캐시 삭제
Write-Host "3. Metro 캐시 삭제 중..." -ForegroundColor Yellow
$metroCachePaths = @(
    "$projectRoot\packages\mobiles\.metro",
    "$projectRoot\packages\mobiles\metro-cache",
    "$projectRoot\node_modules\.cache",
    "$projectRoot\packages\mobiles\node_modules\.cache"
)

foreach ($path in $metroCachePaths) {
    if (Test-Path $path) {
        Remove-Item -Recurse -Force $path -ErrorAction SilentlyContinue
        Write-Host "   ✓ 삭제: $path" -ForegroundColor Green
    }
}
Write-Host "   ✓ Metro 캐시 삭제 완료" -ForegroundColor Green
Write-Host ""

# 4. Expo 캐시 삭제
Write-Host "4. Expo 캐시 삭제 중..." -ForegroundColor Yellow
$expoCachePaths = @(
    "$projectRoot\packages\mobiles\.expo",
    "$env:USERPROFILE\.expo",
    "$env:USERPROFILE\AppData\Local\Expo"
)

foreach ($path in $expoCachePaths) {
    if (Test-Path $path) {
        Remove-Item -Recurse -Force $path -ErrorAction SilentlyContinue
        Write-Host "   ✓ 삭제: $path" -ForegroundColor Green
    }
}
Write-Host "   ✓ Expo 캐시 삭제 완료" -ForegroundColor Green
Write-Host ""

# 5. TypeScript 캐시 삭제
Write-Host "5. TypeScript 캐시 삭제 중..." -ForegroundColor Yellow
$tsCachePaths = @(
    "$projectRoot\*.tsbuildinfo",
    "$projectRoot\packages\*\*.tsbuildinfo",
    "$projectRoot\packages\*\tsconfig.tsbuildinfo"
)

foreach ($path in $tsCachePaths) {
    Get-ChildItem -Path $path -ErrorAction SilentlyContinue | ForEach-Object {
        Remove-Item -Force $_.FullName -ErrorAction SilentlyContinue
        Write-Host "   ✓ 삭제: $($_.FullName)" -ForegroundColor Green
    }
}
Write-Host "   ✓ TypeScript 캐시 삭제 완료" -ForegroundColor Green
Write-Host ""

# 6. Firebase 캐시 삭제
Write-Host "6. Firebase 캐시 삭제 중..." -ForegroundColor Yellow
$firebaseCachePath = "$projectRoot\.firebase"
if (Test-Path $firebaseCachePath) {
    Remove-Item -Recurse -Force $firebaseCachePath -ErrorAction SilentlyContinue
    Write-Host "   ✓ Firebase 캐시 삭제 완료" -ForegroundColor Green
} else {
    Write-Host "   ℹ️  Firebase 캐시 없음" -ForegroundColor Gray
}
Write-Host ""

# 7. 빌드 아티팩트 삭제 (선택사항)
Write-Host "7. 빌드 아티팩트 삭제 중..." -ForegroundColor Yellow
$buildPaths = @(
    "$projectRoot\packages\web-cms\build",
    "$projectRoot\packages\common\dist",
    "$projectRoot\packages\functions\lib"
)

foreach ($path in $buildPaths) {
    if (Test-Path $path) {
        Remove-Item -Recurse -Force $path -ErrorAction SilentlyContinue
        Write-Host "   ✓ 삭제: $path" -ForegroundColor Green
    }
}
Write-Host "   ✓ 빌드 아티팩트 삭제 완료" -ForegroundColor Green
Write-Host ""

# 8. 임시 파일 삭제
Write-Host "8. 임시 파일 삭제 중..." -ForegroundColor Yellow
$tempFiles = @(
    "$projectRoot\*.log",
    "$projectRoot\packages\*\*.log",
    "$projectRoot\.eslintcache"
)

foreach ($pattern in $tempFiles) {
    Get-ChildItem -Path $pattern -ErrorAction SilentlyContinue | ForEach-Object {
        Remove-Item -Force $_.FullName -ErrorAction SilentlyContinue
        Write-Host "   ✓ 삭제: $($_.Name)" -ForegroundColor Green
    }
}
Write-Host "   ✓ 임시 파일 삭제 완료" -ForegroundColor Green
Write-Host ""

# 9. 완료 메시지
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "캐시 삭제 완료!" -ForegroundColor Green
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "다음 단계:" -ForegroundColor Yellow
Write-Host "  1. IDE의 TypeScript 서버 재시작 (VS Code: Ctrl+Shift+P > 'TypeScript: Restart TS Server')" -ForegroundColor White
Write-Host "  2. Metro bundler 시작: cd packages/mobiles && npm start" -ForegroundColor White
Write-Host "  3. Firebase Functions 시작: npm run serve:functions" -ForegroundColor White
Write-Host ""



