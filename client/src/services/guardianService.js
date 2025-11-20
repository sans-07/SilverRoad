import { db } from '../firebase-init';
import firebase from 'firebase/compat/app';
import 'firebase/compat/firestore';

export const guardianService = {
    subscribeToConnectionRequests: (guardianId, callback) => {
        return db.collection('connectionRequests')
            .where('guardianId', '==', guardianId)
            .onSnapshot(snapshot => {
                const reqs = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
                callback(reqs);
            });
    },

    subscribeToLocations: (ansimId, callback) => {
        return db.collection('users').doc(ansimId).collection('locations')
            .orderBy('time')
            .onSnapshot(snapshot => {
                const locations = snapshot.docs.map(doc => doc.data());
                callback(locations);
            });
    },

    subscribeToAlerts: (guardianId, callback) => {
        return db.collection('alerts')
            .where('guardianUid', '==', guardianId)
            .orderBy('createdAt', 'desc')
            .limit(10)
            .onSnapshot(snapshot => {
                const newAlerts = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
                callback(newAlerts);
            });
    },

    checkExistingConnections: async (guardianId) => {
        const existingConnections = await db.collection('connectionRequests')
            .where('guardianId', '==', guardianId)
            .where('status', '==', 'approved')
            .get();
        return !existingConnections.empty;
    },

    approveConnectionRequest: async (requestId, guardianId, ansimId) => {
        const batch = db.batch();

        const requestRef = db.collection('connectionRequests').doc(requestId);
        batch.update(requestRef, { status: 'approved' });

        const guardianRef = db.collection('users').doc(guardianId);
        batch.update(guardianRef, {
            connectedAnsims: firebase.firestore.FieldValue.arrayUnion(ansimId)
        });

        const ansimRef = db.collection('users').doc(ansimId);
        batch.update(ansimRef, {
            guardianId: guardianId
        });

        await batch.commit();
    },

    rejectConnectionRequest: async (requestId) => {
        await db.collection('connectionRequests').doc(requestId).delete();
    },

    disconnectAnsim: async (requestId, guardianId, ansimId) => {
        const batch = db.batch();

        const requestRef = db.collection('connectionRequests').doc(requestId);
        batch.delete(requestRef);

        const guardianRef = db.collection('users').doc(guardianId);
        batch.update(guardianRef, {
            connectedAnsims: firebase.firestore.FieldValue.arrayRemove(ansimId)
        });

        await batch.commit();
    }
};
