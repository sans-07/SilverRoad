
const express = require('express');
const admin = require('firebase-admin');
const cors = require('cors');
const path = require('path');

// --- Firebase 서비스 계정 키 파일 경로 ---
let serviceAccount;
try {
  serviceAccount = require('./serviceAccountKey.json');
} catch (error) {
  console.error(`
  =======================================================================
  [ERROR] Firebase 서비스 계정 키 파일(serviceAccountKey.json)을 찾을 수 없습니다.
  Firebase 콘솔에서 서비스 계정 키를 다운로드하여 프로젝트 루트에 추가해주세요.
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
app.set('json spaces', 2); // JSON 응답을 예쁘게 포맷합니다.

// 정적 파일 제공 (HTML, CSS, JS)
app.use(express.static(path.join(__dirname)));

app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'index.html'));
});
const PORT = 3000;

// Firebase ID 토큰을 확인하는 미들웨어
async function authenticateToken(req, res, next) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).send('Unauthorized: No token provided');
  }
  const idToken = authHeader.split('Bearer ')[1];
  try {
    const decodedToken = await admin.auth().verifyIdToken(idToken);
    req.user = decodedToken; // 요청 객체에 사용자 정보(UID 등) 추가
    next();
  } catch (error) {
    console.error('Error verifying token:', error);
    res.status(403).send('Unauthorized: Invalid token');
  }
}

// 두 지점 간의 거리를 미터(m) 단위로 계산하는 함수 (Haversine formula)
function getDistance(lat1, lon1, lat2, lon2) {
  const R = 6371e3; // 지구 반지름 (미터)
  const φ1 = lat1 * Math.PI / 180;
  const φ2 = lat2 * Math.PI / 180;
  const Δφ = (lat2 - lat1) * Math.PI / 180;
  const Δλ = (lon2 - lon1) * Math.PI / 180;

  const a = Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
            Math.cos(φ1) * Math.cos(φ2) *
            Math.sin(Δλ / 2) * Math.sin(Δλ / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

  return R * c;
}

// 위치 데이터 클러스터링 및 분석 함수 (사용자별)
async function analyzeLocations(uid) {
  const locationsSnapshot = await db.collection('users').doc(uid).collection('locations').get();
  const locations = [];
  locationsSnapshot.forEach(doc => {
    locations.push(doc.data());
  });

  if (locations.length === 0) {
    return [];
  }

  const clusters = [];
  const CLUSTER_RADIUS = 100; // 클러스터로 묶을 반경 (미터)

  locations.forEach(point => {
    let foundCluster = false;
    for (const cluster of clusters) {
      const distance = getDistance(point.lat, point.lng, cluster.center.lat, cluster.center.lng);
      if (distance <= CLUSTER_RADIUS) {
        cluster.points.push(point);
        // 클러스터의 중심점을 새로 추가된 포인트를 포함하여 다시 계산
        const totalPoints = cluster.points.length;
        cluster.center.lat = cluster.points.reduce((sum, p) => sum + p.lat, 0) / totalPoints;
        cluster.center.lng = cluster.points.reduce((sum, p) => sum + p.lng, 0) / totalPoints;
        foundCluster = true;
        break;
      }
    }

    if (!foundCluster) {
      clusters.push({
        center: { lat: point.lat, lng: point.lng },
        points: [point],
      });
    }
  });

  // 각 클러스터의 방문 횟수와 마지막 방문 시간을 계산
  const stats = clusters.map(cluster => {
    // 클러스터 내 포인트들을 시간 역순으로 정렬하여 마지막 방문 시간 찾기
    const lastVisitTime = cluster.points.sort((a, b) => b.time.localeCompare(a.time))[0].time;
    return {
      location: cluster.center,
      visitCount: cluster.points.length,
      lastVisitTime: lastVisitTime
    };
  });

  // 방문 횟수 기준으로 내림차순 정렬
  stats.sort((a, b) => b.visitCount - a.visitCount);

  // 상위 5개 결과 반환
  return stats.slice(0, 5);
}

// API 엔드포인트
app.get('/api/stats', authenticateToken, async (req, res) => {
  try {
    const uid = req.user.uid;
    const top5Locations = await analyzeLocations(uid);
    res.json(top5Locations);
  } catch (error) {
    console.error('Error analyzing locations:', error);
    res.status(500).send('Internal Server Error');
  }
});

app.listen(PORT, () => {
  console.log(`Server is running on http://localhost:${PORT}`);
});
