import { useState, useEffect } from 'react';
import { guardianService } from '../services/guardianService';

export const useGuardianData = (currentUser) => {
    const [requests, setRequests] = useState([]);
    const [connectedAnsim, setConnectedAnsim] = useState(null);
    const [positionData, setPositionData] = useState([]);
    const [alerts, setAlerts] = useState([]);
    const [mapCenter, setMapCenter] = useState([37.5665, 126.9780]); // Default: Seoul

    // Fetch connection requests and handle approved connections
    useEffect(() => {
        if (!currentUser) return;

        const unsubscribe = guardianService.subscribeToConnectionRequests(currentUser.uid, (reqs) => {
            setRequests(reqs);

            const approvedConnection = reqs.find(r => r.status === 'approved');
            if (approvedConnection) {
                setConnectedAnsim(approvedConnection);
            } else {
                setConnectedAnsim(null);
                setPositionData([]);
            }
        });

        return () => unsubscribe();
    }, [currentUser]);

    // Fetch location data for the connected ansim
    useEffect(() => {
        if (!connectedAnsim) return;

        const unsubscribe = guardianService.subscribeToLocations(connectedAnsim.ansimId, (locations) => {
            setPositionData(locations);
            if (locations.length > 0) {
                setMapCenter([locations[locations.length - 1].lat, locations[locations.length - 1].lng]);
            }
        });

        return () => unsubscribe();
    }, [connectedAnsim]);

    // Fetch alerts
    useEffect(() => {
        if (!currentUser) return;

        const unsubscribe = guardianService.subscribeToAlerts(currentUser.uid, (newAlerts) => {
            setAlerts(newAlerts);
        });

        return () => unsubscribe();
    }, [currentUser]);

    // Request Notification Permission and Save Token
    useEffect(() => {
        if (!currentUser) return;

        const requestPermissionAndSaveToken = async () => {
            try {
                // Check notification permission
                const permission = await Notification.requestPermission();
                if (permission === 'granted') {
                    // Import helper dynamically or just assumes it's available since hook imports it? 
                    // Better to import it at top of file, but let's stick to dynamic if we want to be safe or top level.
                    // Actually, let's update imports to include getFcmToken
                    const { getFcmToken } = await import('../firebase-init'); // Dynamic import to match existing pattern if file is huge, or just modify top level import.

                    const token = await getFcmToken();
                    if (token) {
                        console.log("FCM Token retrieved:", token);
                        // Save token to user document
                        await guardianService.saveFemToken(currentUser.uid, token);
                    }
                }
            } catch (error) {
                console.error("Error setting up notifications:", error);
            }
        };

        requestPermissionAndSaveToken();
    }, [currentUser]);

    const approveRequest = async (requestId) => {
        try {
            const hasExisting = await guardianService.checkExistingConnections(currentUser.uid);
            if (hasExisting) {
                alert('이미 연결된 안심이 사용자가 있습니다. 새로운 요청을 수락하려면 기존 연결을 먼저 해제해야 합니다.');
                return;
            }

            const requestToEndorse = requests.find(r => r.id === requestId);
            if (!requestToEndorse) {
                alert('해당 요청을 찾을 수 없습니다.');
                return;
            }

            await guardianService.approveConnectionRequest(requestId, currentUser.uid, requestToEndorse.ansimId);
        } catch (error) {
            console.error("Error approving request:", error);
            alert(`요청 수락 중 오류가 발생했습니다: ${error.message}`);
        }
    };

    const rejectRequest = async (requestId) => {
        try {
            await guardianService.rejectConnectionRequest(requestId);
        } catch (error) {
            console.error("Error rejecting request:", error);
            alert(`요청 거절 중 오류가 발생했습니다: ${error.message}`);
        }
    };

    const disconnectAnsim = async (ansim) => {
        if (!ansim) return;
        try {
            await guardianService.disconnectAnsim(ansim.id, currentUser.uid, ansim.ansimId);
            setConnectedAnsim(null);
            setPositionData([]);
        } catch (error) {
            console.error("Error disconnecting:", error);
            alert(`연결 해제 중 오류가 발생했습니다: ${error.message}`);
        }
    };

    return {
        requests,
        connectedAnsim,
        positionData,
        alerts,
        mapCenter,
        approveRequest,
        rejectRequest,
        disconnectAnsim
    };
};
