const express = require('express');
const router = express.Router();
const authenticateToken = require('../middleware/authMiddleware');

module.exports = (db, admin) => {
  // API 엔드포인트: /api/connection-request
  router.post('/connection-request', authenticateToken, async (req, res) => {
    const { guardianEmail } = req.body;
    const ansimUser = req.user; // User info from authentication middleware

    if (!guardianEmail) {
      return res.status(400).send({ message: '보호자 이메일을 입력해주세요.' });
    }

    try {
      // 1. Search for guardian user by email
      const guardianUserRecord = await admin.auth().getUserByEmail(guardianEmail);
      const guardianDoc = await db.collection('users').doc(guardianUserRecord.uid).get();

      if (!guardianDoc.exists || guardianDoc.data().role !== 'guardian') {
        return res.status(404).send({ message: '해당 이메일을 가진 보호자 사용자를 찾을 수 없습니다.' });
      }

      // 2. Check for existing connection request
      const connectionsRef = db.collection('connectionRequests');
      const existingConnection = await connectionsRef.where('ansimId', '==', ansimUser.uid).get();

      if (!existingConnection.empty) {
        return res.status(409).send({ message: '이미 연결 요청을 보냈거나 연결된 보호자가 있습니다.' });
      }

      // 3. Create connection request document
      await connectionsRef.add({
        ansimId: ansimUser.uid,
        ansimEmail: ansimUser.email,
        guardianId: guardianUserRecord.uid,
        guardianEmail: guardianEmail,
        status: 'pending',
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
      });

      res.status(201).send({ message: '연결 요청을 성공적으로 보냈습니다.' });

    } catch (error) {
      if (error.code === 'auth/user-not-found') {
        return res.status(404).send({ message: '해당 이메일을 가진 보호자 사용자를 찾을 수 없습니다.' });
      }
      console.error('Error creating connection request:', error);
      res.status(500).send({ message: '서버 오류로 인해 요청을 처리하지 못했습니다.' });
    }
  });

  return router;
};