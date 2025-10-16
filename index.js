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
app.use(express.json()); // JSON 요청 본문을 파싱하기 위한 미들웨어
app.set('json spaces', 2); // JSON 응답을 예쁘게 포맷합니다.

// 정적 파일 제공 (HTML, CSS, JS)
app.use(express.static(path.join(__dirname, 'public')));

app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
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

  if (locations.length < 5) { // 유의미한 분석을 위해 최소 5개 이상의 데이터 포인트 필요
    return {
      top5: [],
      safeZone: null
    };
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

  // 최소 방문 횟수(예: 2회) 이상인 클러스터만 필터링
  const MIN_VISIT_COUNT_FOR_TOP = 2;
  const significantStats = stats.filter(s => s.visitCount >= MIN_VISIT_COUNT_FOR_TOP);

  // 방문 횟수 기준으로 내림차순 정렬
  significantStats.sort((a, b) => b.visitCount - a.visitCount);
  const top5Locations = significantStats.slice(0, 5);

  if (top5Locations.length === 0) {
    return {
      top5: [],
      safeZone: null
    };
  }

  // --- 안심 영역 계산 로직 ---
  // 1. TOP 5 클러스터의 중심점(centroid) 계산
  const centroidLat = top5Locations.reduce((sum, stat) => sum + stat.location.lat, 0) / top5Locations.length;
  const centroidLng = top5Locations.reduce((sum, stat) => sum + stat.location.lng, 0) / top5Locations.length;
  const centroid = { lat: centroidLat, lng: centroidLng };

  // 2. 중심점에서 가장 먼 클러스터까지의 거리를 반경으로 설정
  let maxDistance = 0;
  top5Locations.forEach(stat => {
    const distance = getDistance(centroid.lat, centroid.lng, stat.location.lat, stat.location.lng);
    if (distance > maxDistance) {
      maxDistance = distance;
    }
  });

  // 3. 버퍼를 추가하여 최종 반경 결정 (예: 20% 추가)
  const radius = maxDistance * 1.2;

  const safeZone = { center: centroid, radius };

  return { top5: top5Locations, safeZone };
}

// API 엔드포인트
app.get('/api/stats', authenticateToken, async (req, res) => {
  try {
    const uid = req.user.uid;
    const analysisResult = await analyzeLocations(uid);
    res.json(analysisResult);
  } catch (error) {
    console.error('Error analyzing locations:', error);
    res.status(500).send('Internal Server Error');
  }
});

// 새 위치를 수신하고 안심존 이탈을 감지하는 엔드포인트
app.post('/api/locations', authenticateToken, async (req, res) => {
  const { lat, lng, time } = req.body;
  const uid = req.user.uid;

  if (!lat || !lng || !time) {
    return res.status(400).send('Bad Request: Missing location data.');
  }

  try {
    // 1. 사용자 역할 및 정보 확인
    const userDoc = await db.collection('users').doc(uid).get();
    if (!userDoc.exists) {
      return res.status(404).send('User not found.');
    }
    const userData = userDoc.data();

    // 'ansim' 역할이고, 위치 데이터가 10개 이상 쌓였을 때만 이탈 감지 로직 실행
    const locationsSnapshot = await db.collection('users').doc(uid).collection('locations').get();
    const totalLocations = locationsSnapshot.size;

    if (userData.role === 'ansim' && userData.guardianId && totalLocations >= 10) {
      // 2-1. *기존* 데이터로 안심 영역부터 계산
      const { safeZone } = await analyzeLocations(uid);

      if (safeZone) {
        const distance = getDistance(lat, lng, safeZone.center.lat, safeZone.center.lng);

        // 2-2. 안심존 반경을 벗어났는지 확인
        if (distance > safeZone.radius) {
          // 2-3. 알림 생성
          await db.collection('alerts').add({
            ansimUid: uid,
            guardianUid: userData.guardianId,
            location: { lat, lng },
            time: time,
            status: 'new',
            createdAt: admin.firestore.FieldValue.serverTimestamp()
          });
          console.log(`ALERT: User ${uid} is outside their safe zone.`);
        }
      }
    }

    // 3. 모든 확인이 끝난 후, 새 위치 데이터 저장
    await db.collection('users').doc(uid).collection('locations').add({ lat, lng, time });

    res.status(201).send({ message: 'Location saved.' });

  } catch (error) {
    console.error('Error saving location or detecting anomaly:', error);
    res.status(500).send('Internal Server Error');
  }
});

app.listen(PORT, () => {
  console.log(`Server is running on http://localhost:${PORT}`);
});