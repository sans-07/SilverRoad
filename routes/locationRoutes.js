const express = require('express');
const router = express.Router();
const authenticateToken = require('../middleware/authMiddleware');
const { getDistance, analyzeLocations } = require('../services/locationService');

// Export a function that takes db and admin as arguments
module.exports = (db, admin) => {
  // API 엔드포인트: /api/stats (자신의 통계 조회)
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

  // API 엔드포인트: /api/guardian/ansim-stats/:ansimId (보호자가 안심이의 통계 조회)
  router.get('/guardian/ansim-stats/:ansimId', authenticateToken, async (req, res) => {
    const { ansimId } = req.params;
    const guardianUid = req.user.uid;

    try {
      // 1. 권한 확인: 요청한 보호자가 해당 안심이의 보호자로 등록되어 있는지 확인
      const ansimDoc = await db.collection('users').doc(ansimId).get();
      if (!ansimDoc.exists) {
        return res.status(404).send('Ansim user not found.');
      }

      const ansimData = ansimDoc.data();
      if (ansimData.guardianId !== guardianUid) {
        return res.status(403).send('Forbidden: You are not the guardian of this user.');
      }

      // 2. 통계 분석 실행
      const analysisResult = await analyzeLocations(ansimId, db, admin);
      res.json(analysisResult);

    } catch (error) {
      console.error('Error fetching ansim stats for guardian:', error);
      res.status(500).send('Internal Server Error');
    }
  });

  // API 엔드포인트: /api/guardian/safe-zone (수동 안심 구역 설정)
  router.post('/guardian/safe-zone', authenticateToken, async (req, res) => {
    const { ansimId, center, radius, enabled } = req.body;
    const guardianUid = req.user.uid;

    if (!ansimId) {
      return res.status(400).send('Missing ansimId.');
    }

    // If enabling, we need center and radius. If disabling, we don't.
    if (enabled && (!center || !radius)) {
      return res.status(400).send('Missing center or radius for enabling safe zone.');
    }

    try {
      // 1. 권한 확인
      const ansimDoc = await db.collection('users').doc(ansimId).get();
      if (!ansimDoc.exists) {
        return res.status(404).send('Ansim user not found.');
      }
      const ansimData = ansimDoc.data();
      if (ansimData.guardianId !== guardianUid) {
        return res.status(403).send('Forbidden: Not your ansim user.');
      }

      // 2. 설정 저장
      if (enabled) {
        await db.collection('users').doc(ansimId).update({
          manualSafeZone: {
            center,
            radius,
            enabled: true,
            updatedAt: admin.firestore.FieldValue.serverTimestamp()
          }
        });
      } else {
        // Disabling: Remove the field or set enabled: false (Client logic expects removal or null)
        // Let's remove the field to keep it clean, as client sets state to null on delete.
        await db.collection('users').doc(ansimId).update({
          manualSafeZone: admin.firestore.FieldValue.delete()
        });
      }

      res.status(200).send({ message: 'Safe zone updated.' });
    } catch (error) {
      console.error('Error updating safe zone:', error);
      res.status(500).send('Internal Server Error');
    }
  });

  // API 엔드포인트: /api/guardian/set-alert-status (알림 설정 토글)
  router.post('/guardian/set-alert-status', authenticateToken, async (req, res) => {
    const { ansimId, enabled } = req.body;
    const guardianUid = req.user.uid;

    if (!ansimId) return res.status(400).send('Missing ansimId.');
    if (typeof enabled !== 'boolean') return res.status(400).send('Missing enabled status.');

    try {
      const ansimDoc = await db.collection('users').doc(ansimId).get();
      if (!ansimDoc.exists) return res.status(404).send('Ansim user not found.');
      if (ansimDoc.data().guardianId !== guardianUid) return res.status(403).send('Forbidden.');

      await db.collection('users').doc(ansimId).update({
        alertsEnabled: enabled
      });

      res.status(200).send({ message: `Alerts ${enabled ? 'enabled' : 'disabled'}.` });
    } catch (error) {
      console.error('Error updating alert status:', error);
      res.status(500).send('Internal Server Error');
    }
  });

  // API 엔드포인트: /api/guardian/delete-alert (알림 삭제)
  router.post('/guardian/delete-alert', authenticateToken, async (req, res) => {
    const { alertId } = req.body;
    const guardianUid = req.user.uid;

    if (!alertId) return res.status(400).send('Missing alertId.');

    try {
      // 1. 알림 존재 여부 및 권한 확인
      const alertDoc = await db.collection('alerts').doc(alertId).get();
      if (!alertDoc.exists) return res.status(404).send('Alert not found.');

      const alertData = alertDoc.data();
      if (alertData.guardianUid !== guardianUid) {
        return res.status(403).send('Forbidden: Not your alert.');
      }

      // 2. 알림 삭제
      await db.collection('alerts').doc(alertId).delete();

      res.status(200).send({ message: 'Alert deleted.' });
    } catch (error) {
      console.error('Error deleting alert:', error);
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

      // 경보 조건 체크
      if (userData.role === 'ansim' && userData.guardianId) {
        let safeZoneToUse = null;

        // 1순위: 수동 안심 구역
        if (userData.manualSafeZone && userData.manualSafeZone.enabled) {
          safeZoneToUse = userData.manualSafeZone;
          console.log(`Using Manual Safe Zone for user ${uid}`);
        }
        // 2순위: 자동 분석 구역 (데이터 10개 이상)
        else {
          const locationsSnapshot = await db.collection('users').doc(uid).collection('locations').get();
          if (locationsSnapshot.size >= 10) {
            const { safeZone } = await analyzeLocations(uid, db, admin);
            safeZoneToUse = safeZone;
          }
        }

        if (safeZoneToUse) {
          const distance = getDistance(lat, lng, safeZoneToUse.center.lat, safeZoneToUse.center.lng);

          // 범위 이탈 확인
          if (distance > safeZoneToUse.radius) {
            // 알림 설정 확인 (기본값: true)
            const alertsEnabled = userData.alertsEnabled !== false;

            if (alertsEnabled) {
              // 알림 생성
              await db.collection('alerts').add({
                ansimUid: uid,
                guardianUid: userData.guardianId,
                location: { lat, lng },
                time: time,
                status: 'new',
                createdAt: admin.firestore.FieldValue.serverTimestamp(),
                reason: userData.manualSafeZone && userData.manualSafeZone.enabled ? 'manual_zone_exit' : 'auto_zone_exit'
              });
              console.log(`ALERT: User ${uid} is outside their safe zone.`);

              // FCM 전송
              if (userData.guardianId) {
                try {
                  const guardianDoc = await db.collection('users').doc(userData.guardianId).get();
                  if (guardianDoc.exists) {
                    const guardianData = guardianDoc.data();
                    if (guardianData.fcmToken) {
                      const message = {
                        notification: {
                          title: '긴급 알림: 안심 구역 이탈!',
                          body: '피보호자가 안심 구역을 벗어났습니다. 위치를 확인해주세요.'
                        },
                        token: guardianData.fcmToken
                      };

                      admin.messaging().send(message)
                        .then((response) => console.log('Successfully sent message:', response))
                        .catch((error) => console.error('Error sending message:', error));
                    }
                  }
                } catch (error) {
                  console.error('Error fetching guardian data for notification:', error);
                }
              }
            }
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