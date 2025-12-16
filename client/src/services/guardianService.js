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
        const currentUser = firebase.auth().currentUser;
        if (!currentUser) throw new Error("User not authenticated");

        const idToken = await currentUser.getIdToken();
        const response = await fetch('/api/connection/approve', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${idToken}`
            },
            body: JSON.stringify({ requestId, ansimId })
        });

        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.message || 'Failed to approve connection');
        }
    },

    rejectConnectionRequest: async (requestId) => {
        const currentUser = firebase.auth().currentUser;
        if (!currentUser) throw new Error("User not authenticated");

        const idToken = await currentUser.getIdToken();
        const response = await fetch('/api/connection/reject', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${idToken}`
            },
            body: JSON.stringify({ requestId })
        });

        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.message || 'Failed to reject connection');
        }
    },

    disconnectAnsim: async (requestId, guardianId, ansimId) => {
        const currentUser = firebase.auth().currentUser;
        if (!currentUser) throw new Error("User not authenticated");

        const idToken = await currentUser.getIdToken();
        const response = await fetch('/api/connection/disconnect', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${idToken}`
            },
            body: JSON.stringify({ requestId, ansimId })
        });

        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.message || 'Failed to disconnect');
        }
    },

    getAnsimStats: async (ansimId) => {
        const currentUser = firebase.auth().currentUser;
        if (!currentUser) throw new Error("User not authenticated");

        const idToken = await currentUser.getIdToken();
        const response = await fetch(`/api/guardian/ansim-stats/${ansimId}`, {
            headers: {
                'Authorization': `Bearer ${idToken}`
            }
        });

        if (!response.ok) {
            throw new Error(`Failed to fetch stats: ${response.statusText}`);
        }

        return await response.json();
    },

    saveFemToken: async (guardianId, token) => {
        await db.collection('users').doc(guardianId).update({
            fcmToken: token
        });
    },

    saveSafeZone: async (ansimId, center, radius, enabled) => {
        const user = firebase.auth().currentUser;
        if (!user) throw new Error('Not authenticated');

        const token = await user.getIdToken();
        const response = await fetch('/api/guardian/safe-zone', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify({ ansimId, center, radius, enabled })
        });

        if (!response.ok) {
            const errorText = await response.text();
            throw new Error(errorText || 'Failed to save safe zone'); // 서버 에러 메시지를 그대로 전달
        }
        return await response.json();
    }
};
