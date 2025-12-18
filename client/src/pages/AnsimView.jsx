import React, { useState, useEffect } from 'react';
import { MapContainer, TileLayer, Marker, Popup, Polyline, Circle } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';

// --- Fix for Leaflet Default Marker Icon ---
import markerIcon2x from 'leaflet/dist/images/marker-icon-2x.png';
import markerIcon from 'leaflet/dist/images/marker-icon.png';
import markerShadow from 'leaflet/dist/images/marker-shadow.png';

delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: markerIcon2x,
  iconUrl: markerIcon,
  shadowUrl: markerShadow,
});
// -------------------------------------------
import './AnsimView.css';
import '../components/Button.css';
import '../components/Card.css';
import { useAuth } from '../context/AuthContext';
import { db } from '../firebase-init';
import MapResizer from '../components/MapResizer';
import { kakaoMapService } from '../services/kakaoMapService';

// Define custom red marker icon
const redIcon = new L.Icon({
  iconUrl: 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-red.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/0.7.7/images/marker-shadow.png',
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  popupAnchor: [1, -34],
  shadowSize: [41, 41]
});

// Define custom green marker icon for current location
const greenIcon = new L.Icon({
  iconUrl: 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-green.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/0.7.7/images/marker-shadow.png',
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  popupAnchor: [1, -34],
  shadowSize: [41, 41]
});

function AnsimView() {
  const { currentUser } = useAuth();
  const [positionData, setPositionData] = useState([]);
  const [detailedPath, setDetailedPath] = useState([]);
  const [mapCenter, setMapCenter] = useState([37.5665, 126.9780]); // Default: Seoul
  const [isCollecting, setIsCollecting] = useState(false);
  const [intervalId, setIntervalId] = useState(null);
  const [status, setStatus] = useState('대기 중');
  const [guardianEmail, setGuardianEmail] = useState('');
  const [connectionStatus, setConnectionStatus] = useState('연결되지 않음');
  const [statsData, setStatsData] = useState({ top5: [], safeZone: null });
  const [currentLocation, setCurrentLocation] = useState(null);
  const [manualSafeZone, setManualSafeZone] = useState(null);

  // Watch current position
  useEffect(() => {
    if (!navigator.geolocation) return;

    const watchId = navigator.geolocation.watchPosition(
      (position) => {
        setCurrentLocation({
          lat: position.coords.latitude,
          lng: position.coords.longitude,
        });
      },
      (error) => console.error('Error getting current location:', error),
      { enableHighAccuracy: true, timeout: 15000, maximumAge: 10000 }
    );

    return () => navigator.geolocation.clearWatch(watchId);
  }, []);

  // Fetch stats data
  useEffect(() => {
    if (!currentUser) return;

    const fetchStats = async () => {
      try {
        const idToken = await currentUser.getIdToken(true);
        const response = await fetch('/api/stats', {
          headers: { 'Authorization': `Bearer ${idToken}` }
        });

        if (!response.ok) throw new Error(`Server error: ${response.statusText}`);

        const analysisResult = await response.json();
        setStatsData(analysisResult);
      } catch (error) {
        console.error('통계 데이터 로딩 오류:', error);
      }
    };

    fetchStats();
  }, [currentUser]);

  // Fetch manual safe zone
  useEffect(() => {
    if (!currentUser) return;

    const unsubscribe = db.collection('users').doc(currentUser.uid).onSnapshot(doc => {
      if (doc.exists) {
        const data = doc.data();
        if (data.manualSafeZone && data.manualSafeZone.enabled) {
          setManualSafeZone(data.manualSafeZone);
        } else {
          setManualSafeZone(null);
        }
      }
    });

    return () => unsubscribe();
  }, [currentUser]);

  // Load initial location data from Firestore
  useEffect(() => {
    if (!currentUser) return;

    const userLocationsCollection = db.collection('users').doc(currentUser.uid).collection('locations');

    const unsubscribeLocations = userLocationsCollection.orderBy("time").onSnapshot(snapshot => {
      const locations = [];
      snapshot.forEach(doc => {
        const data = doc.data();
        locations.push({ lat: data.lat, lng: data.lng, time: data.time });
      });
      setPositionData(locations);

      if (locations.length > 0) {
        setMapCenter([locations[locations.length - 1].lat, locations[locations.length - 1].lng]);
      }
    }, err => {
      console.error("Error fetching location data:", err);
      setStatus('오류: 위치 데이터 로딩 실패');
    });

    return () => unsubscribeLocations();
  }, [currentUser]);

  // Calculate Smart Path (Road View)
  useEffect(() => {
    const calculatePath = async () => {
      if (positionData.length < 2) {
        setDetailedPath([]);
        return;
      }

      const newPath = [];

      for (let i = 0; i < positionData.length - 1; i++) {
        const start = positionData[i];
        const end = positionData[i + 1];

        // Fetch real road path
        const roadPath = await kakaoMapService.fetchRoute(
          { lat: start.lat, lng: start.lng },
          { lat: end.lat, lng: end.lng }
        );

        if (roadPath) {
          newPath.push(...roadPath);
        } else {
          // Fallback to straight line
          newPath.push({ lat: start.lat, lng: start.lng });
          newPath.push({ lat: end.lat, lng: end.lng });
        }
      }

      setDetailedPath(newPath);
    };

    calculatePath();
  }, [positionData]);

  // Check connection status
  useEffect(() => {
    if (!currentUser) return;

    const connectionsRef = db.collection('connectionRequests');
    const unsubscribeConnections = connectionsRef.where('ansimId', '==', currentUser.uid)
      .onSnapshot(snapshot => {
        if (snapshot.empty) {
          setConnectionStatus('연결되지 않음');
          return;
        }
        const connection = snapshot.docs[0].data();
        switch (connection.status) {
          case 'pending':
            setConnectionStatus(`'${connection.guardianEmail}'님에게 요청 보냄 (대기중)`);
            break;
          case 'approved':
            setConnectionStatus(`'${connection.guardianEmail}'님과 연결됨`);
            break;
          default:
            setConnectionStatus('연결되지 않음');
        }
      });

    return () => unsubscribeConnections();
  }, [currentUser]);

  // Cleanup interval
  useEffect(() => {
    return () => {
      if (intervalId) clearInterval(intervalId);
    };
  }, [intervalId]);

  const collectPosition = async () => {
    if (!currentUser) {
      setStatus('사용자 정보가 없습니다.');
      return;
    }

    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        const { latitude, longitude } = pos.coords;
        const time = new Date().toISOString();
        const newPosition = { lat: latitude, lng: longitude, time: time };

        try {
          const idToken = await currentUser.getIdToken(true);
          const response = await fetch('/api/locations', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${idToken}`
            },
            body: JSON.stringify(newPosition)
          });
          if (!response.ok) throw new Error('Server responded with an error');

          setStatus('위치 수집 중...');
        } catch (err) {
          console.error("API 호출 오류:", err);
          setStatus('오류: 위치 저장 실패');
        }
      },
      (err) => {
        console.error("Error getting location:", err);
        setStatus('오류: 위치 정보를 가져올 수 없습니다.');
      }
    );
  };

  const startCollection = () => {
    if (isCollecting) return;
    setIsCollecting(true);
    setStatus('위치 수집 시작...');
    collectPosition();
    const newIntervalId = setInterval(collectPosition, 10000);
    setIntervalId(newIntervalId);
  };

  const stopCollection = () => {
    if (!isCollecting || !intervalId) return;
    clearInterval(intervalId);
    setIntervalId(null);
    setIsCollecting(false);
    setStatus('수집 중지');
  };

  const downloadCSV = () => {
    if (positionData.length === 0) {
      alert("다운로드할 위치 데이터가 없습니다.");
      return;
    }
    const csvHeader = "latitude,longitude,timestamp\n";
    const csvRows = positionData.map(pos => `${pos.lat},${pos.lng},"${new Date(pos.time).toLocaleString()}"`).join("\n");
    const csvContent = csvHeader + csvRows;

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement("a");
    if (link.download !== undefined) {
      const url = URL.createObjectURL(blob);
      link.setAttribute("href", url);
      link.setAttribute("download", "location_data.csv");
      link.style.visibility = 'hidden';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    }
  };

  const sendConnectionRequest = async () => {
    if (!guardianEmail || !currentUser) {
      alert('보호자 이메일을 입력해주세요.');
      return;
    }
    try {
      const token = await currentUser.getIdToken();
      const response = await fetch('/api/connection-request', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({ guardianEmail }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.message || '알 수 없는 오류가 발생했습니다.');

      setGuardianEmail('');
      alert(data.message);
    } catch (error) {
      console.error('Error sending connection request:', error);
      alert(`오류: ${error.message}`);
    }
  };

  return (
    <div className="ansim-view-container">
      {/* Floating Controls */}
      <div className="ansim-controls-overlay">
        <div className="control-section">
          <h3>위치 수집</h3>
          <div className={`status-badge ${isCollecting ? 'active' : ''}`} style={{ marginBottom: '12px' }}>
            {status}
          </div>
          <div style={{ display: 'flex', gap: '8px' }}>
            <button
              className="btn btn-primary"
              style={{ flex: 1 }}
              onClick={startCollection}
              disabled={isCollecting}
            >
              시작
            </button>
            <button
              className="btn btn-danger"
              style={{ flex: 1 }}
              onClick={stopCollection}
              disabled={!isCollecting}
            >
              중지
            </button>
          </div>
          <button className="btn btn-secondary btn-block" style={{ marginTop: '8px' }} onClick={downloadCSV}>
            CSV 다운로드
          </button>
        </div>

        <div className="control-section">
          <h3>보호자 연결</h3>
          <div className="connection-status">
            {connectionStatus}
          </div>
          <div className="input-group" style={{ marginBottom: '8px' }}>
            <input
              type="email"
              className="input-field"
              value={guardianEmail}
              onChange={(e) => setGuardianEmail(e.target.value)}
              placeholder="보호자 이메일 입력"
            />
          </div>
          <button className="btn btn-primary btn-block" onClick={sendConnectionRequest}>
            연결 요청 보내기
          </button>
        </div>
      </div>

      {/* Map */}
      <div className="map-wrapper">
        <MapContainer center={mapCenter} zoom={13} style={{ height: '100%', width: '100%' }}>
          <TileLayer
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
          />

          {positionData.map((pos, idx) => (
            <Marker key={idx} position={[pos.lat, pos.lng]}>
              <Popup>시간: {new Date(pos.time).toLocaleString()}</Popup>
            </Marker>
          ))}

          {detailedPath.length > 0 && (
            <Polyline positions={detailedPath.map(p => [p.lat, p.lng])} color="blue" />
          )}

          {/* Auto Safe Zone (Green) - Only show if manual is NOT enabled */}
          {statsData.safeZone && !manualSafeZone && (
            <Circle
              center={[statsData.safeZone.center.lat, statsData.safeZone.center.lng]}
              radius={statsData.safeZone.radius}
              pathOptions={{ color: 'green', fillColor: '#0f0', fillOpacity: 0.2 }}
            >
              <Popup>자동 안심 영역</Popup>
            </Circle>
          )}

          {/* Manual Safe Zone (Blue) */}
          {manualSafeZone && (
            <Circle
              center={[manualSafeZone.center.lat, manualSafeZone.center.lng]}
              radius={manualSafeZone.radius}
              pathOptions={{ color: 'blue', fillColor: '#00f', fillOpacity: 0.2, dashArray: '5, 10' }}
            >
              <Popup>수동 안심 영역</Popup>
            </Circle>
          )}

          {statsData.top5.map((item, index) => (
            <Marker
              key={`top5-${index}`}
              position={[item.location.lat, item.location.lng]}
              icon={redIcon}
            >
              <Popup>
                <b>자주 가는 곳 TOP {index + 1}</b><br />
                방문 횟수: {item.visitCount}회<br />
                마지막 방문: {new Date(item.lastVisitTime).toLocaleString('ko-KR')}
              </Popup>
            </Marker>
          ))}

          {currentLocation && (
            <Marker position={[currentLocation.lat, currentLocation.lng]} icon={greenIcon}>
              <Popup>현재 위치</Popup>
            </Marker>
          )}

          <MapResizer />
        </MapContainer>
      </div>
    </div>
  );
}

export default AnsimView;
