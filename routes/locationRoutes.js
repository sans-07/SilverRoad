const express = require('express');
const router = express.Router();
const authenticateToken = require('../middleware/authMiddleware');
const { getDistance, analyzeLocations } = require('../services/locationService');

// Export a function that takes db and admin as arguments
module.exports = (db, admin) => {
  // API 엔드포인트: /api/stats
  router.get('/stats', authenticateToken, async (req, res) => {
    try {
      const uid = req.user.uid;
      const analysisResult = await analyzeLocations(uid, db, admin);
      res.json(analysisResult);
    } catch (error) {
      console.error('Error analyzing locations:', error);
      res.status(500).send('Internal Server Error');
    }
  });

  // API 엔드포인트: /api/locations
  router.post('/locations', authenticateToken, async (req, res) => {
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
        const { safeZone } = await analyzeLocations(uid, db, admin);

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

  return router;
};