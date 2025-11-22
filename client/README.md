# SilverRoad Client

SilverRoad 프로젝트의 프론트엔드 애플리케이션입니다.
React와 Vite를 기반으로 구축되었으며, 보호자(Guardian)가 피보호자의 위치를 확인하고 안전 구역을 관리하는 기능을 제공합니다.

## 주요 기능

- **실시간 위치 확인**: Leaflet 지도를 통해 피보호자의 위치를 시각적으로 확인
- **안전 구역 관리**: 안전 구역 이탈 시 알림 및 관리
- **보호자 대시보드**: 피보호자 상태 요약 및 일일 리포트(AI Daily Care Letter) 확인

## 기술 스택

- **Core**: React, Vite
- **Routing**: React Router DOM
- **Maps**: Leaflet, React Leaflet
- **Integration**: Firebase, Node.js/Express API 연동

## 시작하기 (Getting Started)

### 설치
프로젝트 폴더(`client`)로 이동 후 의존성 패키지를 설치합니다.

```bash
npm install
```

### 개발 서버 실행
로컬 개발 환경에서 서버를 실행합니다.

```bash
npm run dev
```

### 빌드
배포를 위한 프로덕션 빌드를 생성합니다.

```bash
npm run build
```
