# SilverRoad

어르신 안심 귀가 및 보호자 모니터링 서비스입니다.

## 기술 스택

- **Frontend**: React, Vite, Leaflet, Firebase
- **Backend**: Node.js, Express, Firebase Admin

## 설치 및 실행

### Server
루트 디렉토리에서 실행:
```bash
npm install
npm start
```

### Client
`client` 디렉토리에서 실행:
```bash
cd client
npm install
npm run dev
```

## Docker로 실행하기

### 1. 준비 사항
- 프로젝트 루트에 보안 파일들이 있어야 합니다:
  - `.env` (환경 변수)
  - `serviceAccountKey.json` (Firebase 키)

### 2. 실행 명령어
터미널에서 다음 명령어를 입력하세요:
```bash
docker-compose up --build
```

### 3. 접속 확인
- **웹 서비스**: http://localhost
- **서버 API**: http://localhost:3000

## 환경 변수

루트와 `client` 디렉토리에 각각 `.env` 파일이 필요합니다.
