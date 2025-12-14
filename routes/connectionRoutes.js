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

  // API 엔드포인트: /api/connection/approve
  router.post('/connection/approve', authenticateToken, async (req, res) => {
    const { requestId, ansimId } = req.body;
    const guardianUid = req.user.uid;

    if (!requestId || !ansimId) {
      return res.status(400).send({ message: 'Missing requestId or ansimId.' });
    }

    try {
      // 1. Verify the request exists and belongs to this guardian
      const requestRef = db.collection('connectionRequests').doc(requestId);
      const requestDoc = await requestRef.get();

      if (!requestDoc.exists) {
        return res.status(404).send({ message: 'Request not found.' });
      }

      if (requestDoc.data().guardianId !== guardianUid) {
        return res.status(403).send({ message: 'Unauthorized action.' });
      }

      // 2. Perform atomic updates
      const batch = db.batch();

      // Update request status
      batch.update(requestRef, { status: 'approved' });

      // Update Guardian document (add to connectedAnsims)
      const guardianRef = db.collection('users').doc(guardianUid);
      batch.update(guardianRef, {
        connectedAnsims: admin.firestore.FieldValue.arrayUnion(ansimId)
      });

      // Update Ansim document (set guardianId)
      const ansimRef = db.collection('users').doc(ansimId);
      batch.update(ansimRef, {
        guardianId: guardianUid
      });

      await batch.commit();

      res.status(200).send({ message: 'Connection approved successfully.' });

    } catch (error) {
      console.error('Error approving connection:', error);
      res.status(500).send({ message: 'Internal Server Error' });
    }
  });

  // API 엔드포인트: /api/connection/reject
  router.post('/connection/reject', authenticateToken, async (req, res) => {
    const { requestId } = req.body;
    const guardianUid = req.user.uid;

    try {
      const requestRef = db.collection('connectionRequests').doc(requestId);
      const requestDoc = await requestRef.get();

      if (!requestDoc.exists) {
        return res.status(404).send({ message: 'Request not found.' });
      }

      if (requestDoc.data().guardianId !== guardianUid) {
        return res.status(403).send({ message: 'Unauthorized action.' });
      }

      await requestRef.delete();
      res.status(200).send({ message: 'Connection request rejected.' });

    } catch (error) {
      console.error('Error rejecting connection:', error);
      res.status(500).send({ message: 'Internal Server Error' });
    }
  });

  // API 엔드포인트: /api/connection/disconnect
  router.post('/connection/disconnect', authenticateToken, async (req, res) => {
    const { requestId, ansimId } = req.body; // requestId might be optional if we just look up by relationship, but the client has it.
    const guardianUid = req.user.uid;

    try {
      const batch = db.batch();

      // Delete the connection request doc (if passed, or we could just query for it)
      if (requestId) {
        const requestRef = db.collection('connectionRequests').doc(requestId);
        batch.delete(requestRef);
      }

      // Update Guardian (remove from connectedAnsims)
      const guardianRef = db.collection('users').doc(guardianUid);
      batch.update(guardianRef, {
        connectedAnsims: admin.firestore.FieldValue.arrayRemove(ansimId)
      });

      // Update Ansim (remove guardianId)
      // Note: We need to be careful not to unset if they already switched guardians, but typically disconnect implies breaking the current link.
      // Ideally we check if guardianId matches current user, but for now we assume consistency.
      const ansimRef = db.collection('users').doc(ansimId);
      // We can use FieldValue.delete() for the field, or set to null/empty string.
      // Let's check current guardianId just to be safe (optional but good practice).
      const ansimDoc = await ansimRef.get();
      if (ansimDoc.exists && ansimDoc.data().guardianId === guardianUid) {
        batch.update(ansimRef, {
          guardianId: admin.firestore.FieldValue.delete()
        });
      }

      await batch.commit();

      res.status(200).send({ message: 'Disconnected successfully.' });

    } catch (error) {
      console.error('Error disconnecting:', error);
      res.status(500).send({ message: 'Internal Server Error' });
    }
  });

  return router;
};