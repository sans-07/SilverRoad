require('dotenv').config(); // .env 파일에서 환경 변수를 로드합니다.

const express = require('express');
const admin = require('firebase-admin');
const cors = require('cors');
const path = require('path'); // Re-added path

const authenticateToken = require('./middleware/authMiddleware'); // Import the auth middleware
const locationRoutes = require('./routes/locationRoutes'); // Import location routes
const connectionRoutes = require('./routes/connectionRoutes'); // Import connection routes



// --- Firebase 서비스 계정 키 파일 경로 ---
let serviceAccount;
const serviceAccountPath = process.env.SERVICE_ACCOUNT_KEY_PATH;

if (!serviceAccountPath) {
  console.error(`
  =======================================================================
  [ERROR] SERVICE_ACCOUNT_KEY_PATH 환경 변수가 설정되지 않았습니다.
  .env 파일에 서비스 계정 키 파일의 경로를 설정해주세요.
  예: SERVICE_ACCOUNT_KEY_PATH=./serviceAccountKey.json
  =======================================================================
  `);
  process.exit(1);
}

try {
  serviceAccount = require(serviceAccountPath);
} catch (error) {
  console.error(`
  =======================================================================
  [ERROR] Firebase 서비스 계정 키 파일(${serviceAccountPath})을 찾을 수 없습니다.
  Firebase 콘솔에서 서비스 계정 키를 다운로드하여 지정된 경로에 추가해주세요.
  이 파일은 .gitignore에 의해 Git 저장소에 포함되지 않아야 합니다.
  =======================================================================
  `);
  process.exit(1); // Exit the application
}

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount)
});

const db = admin.firestore();
const app = express();
app.use(cors());
app.use(express.json()); // JSON 요청 본문을 파싱하기 위한 미들웨어
app.use('/api', locationRoutes(db, admin)); // Use location routes, passing db and admin
app.use('/api', connectionRoutes(db, admin)); // Use connection routes, passing db and admin
app.set('json spaces', 2); // JSON 응답을 예쁘게 포맷합니다.

// Content Security Policy 설정
app.use((req, res, next) => {
  res.setHeader('Content-Security-Policy', "script-src 'self' https://www.gstatic.com https://*.firebaseio.com https://unpkg.com 'sha256-IFVlJVT2yoTYQ53jyGALTmUbjOlv0igXKRZ3+makTV0='; object-src 'none'; base-uri 'self';");
  next();
});

// 정적 파일 제공 (HTML, CSS, JS) - React 앱으로 대체되었으므로 주석 처리
app.use(express.static(path.join(__dirname, 'public')));
const PORT = 3000;




app.listen(PORT, () => {
  console.log(`Server is running on http://localhost:${PORT}`);
});