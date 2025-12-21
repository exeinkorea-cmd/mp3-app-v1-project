# Node.js 22 수동 설치 가이드 (Windows)

## 방법 1: 공식 설치 프로그램 사용 (권장)

### 1단계: Node.js 22 다운로드
1. 브라우저에서 다음 URL로 이동:
   - **LTS 버전**: https://nodejs.org/ko/download/releases/
   - 또는 **최신 버전**: https://nodejs.org/ko/download/

2. Node.js 22.x 버전을 선택합니다
   - Windows 64-bit: `node-v22.x.x-x64.msi` 파일 다운로드
   - Windows 32-bit: `node-v22.x.x-x86.msi` 파일 다운로드

### 2단계: 설치 실행
1. 다운로드한 `.msi` 파일을 더블클릭하여 실행
2. 설치 마법사를 따라 진행:
   - **중요**: "Add to PATH" 옵션이 선택되어 있는지 확인
   - 기본 설정으로 설치 진행 (Next 클릭)
3. 설치 완료 후 터미널을 **새로 열어서** 확인:
   ```powershell
   node --version
   npm --version
   ```

### 3단계: 설치 확인 및 프로젝트 설정
설치가 완료되면 다음 스크립트를 실행하세요:
```powershell
cd mp3-app-v1-project
.\scripts\setup-node22.ps1
```

---

## 방법 2: nvm-windows 사용 (여러 버전 관리)

### 1단계: nvm-windows 설치
1. https://github.com/coreybutler/nvm-windows/releases 에서 최신 버전 다운로드
2. `nvm-setup.exe` 파일을 실행하여 설치

### 2단계: Node.js 22 설치
PowerShell을 **관리자 권한**으로 실행 후:
```powershell
nvm install 22
nvm use 22
```

### 3단계: 설치 확인
```powershell
node --version
npm --version
```

### 4단계: 프로젝트 설정
```powershell
cd mp3-app-v1-project
.\scripts\setup-node22.ps1
```

---

## 설치 후 확인 사항

1. **Node.js 버전 확인**:
   ```powershell
   node --version
   ```
   출력: `v22.x.x` (22로 시작해야 함)

2. **npm 버전 확인**:
   ```powershell
   npm --version
   ```

3. **기존 Node.js 제거 (선택사항)**:
   - 제어판 > 프로그램 제거에서 이전 Node.js 버전 제거 가능
   - 또는 nvm-windows를 사용하면 자동으로 버전 관리됨

---

## 문제 해결

### 문제: `node` 명령어를 찾을 수 없음
- **해결**: 터미널을 완전히 종료하고 새로 열기
- 또는 시스템 환경 변수 PATH에 Node.js 경로가 추가되었는지 확인

### 문제: 여전히 이전 버전이 표시됨
- **해결**: 
  1. 모든 터미널 창을 닫고 새로 열기
  2. `where node` 명령어로 여러 Node.js 설치 경로 확인
  3. PATH 환경 변수에서 이전 경로 제거

### 문제: 설치 후 프로젝트 오류 발생
- **해결**: `setup-node22.ps1` 스크립트 실행하여 node_modules 재설치

---

## 참고 링크
- Node.js 공식 다운로드: https://nodejs.org/ko/download/
- Node.js 릴리스 페이지: https://nodejs.org/ko/download/releases/
- nvm-windows: https://github.com/coreybutler/nvm-windows




