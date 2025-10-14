# Silver Road: 위치 기록 및 분석 웹 애플리케이션

이 프로젝트는 사용자의 실시간 위치를 기록하고, 자주 방문하는 장소를 분석하여 지도에 시각화해주는 웹 애플리케이션입니다.

## 기술 스택

- **프론트엔드**: HTML, CSS, JavaScript, Leaflet.js
- **백엔드**: Node.js, Express.js
- **데이터베이스**: Firebase (Authentication, Firestore)

## 설정 및 실행 방법

1.  **의존성 설치**
    ```bash
    npm install
    ```

2.  **Firebase 설정**
    - **서비스 계정 키**: Firebase 콘솔에서 '서비스 계정'의 비공개 키를 생성하여 다운로드하고, `serviceAccountKey.json` 파일로 프로젝트 루트 디렉토리에 저장하세요. 이 파일은 `.gitignore`에 의해 관리되므로 Git 저장소에는 포함되지 않습니다.
    - **웹 API 키**: `index.html`, `login.html`, `collection.html` 파일에 있는 `firebaseConfig` 객체의 값들을 본인의 Firebase 프로젝트 정보로 채워주세요.

3.  **서버 실행**
    ```bash
    node index.js
    ```
    서버가 3000번 포트에서 실행됩니다. `http://localhost:3000`으로 접속하세요.

## 테스트용 임시 데이터 추가

프로젝트에는 파란색 경로 마커와 빨간색 TOP 5 마커의 동작을 테스트하기 위한 스크립트가 포함되어 있습니다.

- **파일**: `temp_data_script.txt`

### 사용법

1.  웹사이트에 로그인하여 `collection.html` 페이지로 이동합니다.
2.  브라우저에서 F12 키를 눌러 개발자 도구를 엽니다.
3.  `temp_data_script.txt` 파일의 내용을 모두 복사합니다.
4.  개발자 도구의 'Console' 탭에 복사한 내용을 붙여넣고 Enter 키를 누릅니다. (보안 경고가 나타나면 `allow pasting`을 입력해야 할 수 있습니다.)
5.  스크립트가 실행되면 DB에 임시 데이터가 추가됩니다. 페이지를 새로고침하여 지도에 표시된 마커를 확인하세요.
