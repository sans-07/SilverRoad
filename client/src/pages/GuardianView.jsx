import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { MapContainer, TileLayer, Marker, Popup, Polyline, Circle, useMapEvents } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import './GuardianView.css';
import '../components/Button.css';
import '../components/Card.css';
import MapResizer from '../components/MapResizer';
import GuardianControls from '../components/GuardianControls';
import { useGuardianData } from '../hooks/useGuardianData';
import { kakaoMapService } from '../services/kakaoMapService';
import { guardianService } from '../services/guardianService';
import { db } from '../firebase-init';

// --- Fix for Leaflet Default Marker Icon ---
import L from 'leaflet';
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

// Component to handle map clicks
function MapEvents({ isEditing, onMapClick }) {
  useMapEvents({
    click: (e) => {
      if (isEditing) {
        onMapClick(e.latlng);
      }
    },
  });
  return null;
}

function GuardianView() {
  const { currentUser } = useAuth();
  const {
    requests,
    connectedAnsim,
    positionData,
    alerts,
    mapCenter,
    approveRequest,
    rejectRequest,
    disconnectAnsim
  } = useGuardianData(currentUser);

  const [detailedPath, setDetailedPath] = useState([]);
  const [safeZone, setSafeZone] = useState(null);

  // AI Summary state
  const [isGeneratingSummary, setIsGeneratingSummary] = useState(false);
  const [summaryData, setSummaryData] = useState(null);

  // Manual Safe Zone State
  const [manualSafeZone, setManualSafeZone] = useState(null);
  const [isEditingSafeZone, setIsEditingSafeZone] = useState(false);
  const [editRadius, setEditRadius] = useState(500); // Default 500m
  const [editCenter, setEditCenter] = useState(null);

  // Fetch Safe Zone Data (Both Auto and Manual)
  useEffect(() => {
    if (connectedAnsim) {
      guardianService.getAnsimStats(connectedAnsim.ansimId)
        .then(data => {
          // Auto Safe Zone
          if (data.safeZone) {
            setSafeZone(data.safeZone);
          }
        })
        .catch(err => console.error("Failed to load safe zone:", err));

      db.collection('users').doc(connectedAnsim.ansimId).get().then(doc => {
        if (doc.exists) {
          const data = doc.data();
          if (data.manualSafeZone) {
            setManualSafeZone(data.manualSafeZone);
            setEditRadius(data.manualSafeZone.radius);
            setEditCenter(data.manualSafeZone.center);
          }
        }
      });

    } else {
      setSafeZone(null);
      setManualSafeZone(null);
      setDetailedPath([]);
    }
  }, [connectedAnsim]);

  const activeSafeZone = (manualSafeZone && manualSafeZone.enabled) ? manualSafeZone : safeZone;

  // Calculate Smart Path
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

        // Always attempt to fetch real road path
        // Use Kakao API for real road path
        const roadPath = await kakaoMapService.fetchRoute(
          { lat: start.lat, lng: start.lng },
          { lat: end.lat, lng: end.lng }
        );

        if (roadPath) {
          newPath.push(...roadPath);
        } else {
          // Fallback to straight line if API fails
          newPath.push({ lat: start.lat, lng: start.lng });
          newPath.push({ lat: end.lat, lng: end.lng });
        }
      }

      setDetailedPath(newPath);
    };

    calculatePath();
  }, [positionData, activeSafeZone]);

  // Handlers
  const handleEditToggle = () => {
    setIsEditingSafeZone(!isEditingSafeZone);
    if (!isEditingSafeZone && manualSafeZone) {
      setEditCenter(manualSafeZone.center);
      setEditRadius(manualSafeZone.radius);
    }
  };

  const handleMapClick = (latlng) => {
    setEditCenter({ lat: latlng.lat, lng: latlng.lng });
  };

  const handleSaveSafeZone = async () => {
    if (!editCenter) {
      alert("지도에서 중심점을 선택해주세요.");
      return;
    }
    try {
      await guardianService.saveSafeZone(connectedAnsim.ansimId, editCenter, editRadius, true);
      setManualSafeZone({ center: editCenter, radius: editRadius, enabled: true });
      setIsEditingSafeZone(false);
      alert("안심 구역이 저장되었습니다.");
    } catch (error) {
      console.error(error);
      alert("저장 실패: " + error.message);
    }
  };

  const handleDeleteSafeZone = async () => {
    if (!window.confirm("수동 안심 구역을 삭제하시겠습니까?")) return;
    try {
      await guardianService.saveSafeZone(connectedAnsim.ansimId, null, 0, false); // Or separate delete API
      setManualSafeZone(null);
      setEditCenter(null);
      setIsEditingSafeZone(false);
      alert("삭제되었습니다.");
    } catch (error) {
      console.error(error);
      alert("삭제 실패");
    }
  };

  const handleGenerateSummary = () => {
    setIsGeneratingSummary(true);

    // Simulate API call
    setTimeout(() => {
      const mockSummary = `오늘 ${connectedAnsim?.ansimEmail.split('@')[0] || '안심이'}님은 활동적인 하루를 보내셨네요! ☀️

오전 10시에 **시민공원**으로 외출하셔서 약 **40분간 산책**을 즐기셨습니다.
총 이동 거리는 **2.5km**로 어제보다 조금 더 많이 걸으셨어요. 🚶

현재는 댁에서 휴식 중이십니다.
저녁에 따뜻한 안부 전화 한 통 어떠세요? 📞`;

      setSummaryData(mockSummary);
      setIsGeneratingSummary(false);
    }, 2000);
  };

  // Helper for distance (Haversine) - moved outside component to ensure availability
  const getDistance = (lat1, lon1, lat2, lon2) => {
    const R = 6371e3;
    const φ1 = lat1 * Math.PI / 180;
    const φ2 = lat2 * Math.PI / 180;
    const Δφ = (lat2 - lat1) * Math.PI / 180;
    const Δλ = (lon2 - lon1) * Math.PI / 180;

    const a = Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
      Math.cos(φ1) * Math.cos(φ2) *
      Math.sin(Δλ / 2) * Math.sin(Δλ / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

    return R * c;
  };

  return (
    <div className="guardian-view-container">
      <GuardianControls
        requests={requests}
        connectedAnsim={connectedAnsim}
        alerts={alerts}
        onApprove={approveRequest}
        onReject={rejectRequest}
        onDisconnect={disconnectAnsim}
        onGenerateSummary={handleGenerateSummary}
        summaryData={summaryData}
        isGeneratingSummary={isGeneratingSummary}
        setSummaryData={setSummaryData}
      />

      {/* Manual Safe Zone Overlay */}
      {connectedAnsim && (
        <div className="guardian-controls-overlay">
          <div className="map-control-card">
            <h3>🛡️ 안심 구역 설정</h3>

            {!isEditingSafeZone ? (
              <div>
                <p style={{ fontSize: '13px', color: '#666', marginBottom: '10px' }}>
                  {manualSafeZone && manualSafeZone.enabled
                    ? "현재 '수동 설정 모드'가 활성화되어 있습니다."
                    : "현재 '자동 분석 모드'가 작동 중입니다."}
                </p>
                <button className="btn btn-primary btn-block" onClick={handleEditToggle}>
                  {manualSafeZone ? "설정 변경" : "수동 구역 추가"}
                </button>
              </div>
            ) : (
              <div>
                <p style={{ fontSize: '12px', color: '#666', marginBottom: '5px' }}>
                  지도에서 중심점을 클릭하세요.
                </p>
                <div className="range-slider-container">
                  <label>반경: {editRadius}m</label>
                  <input
                    type="range"
                    min="100"
                    max="3000"
                    step="100"
                    value={editRadius}
                    onChange={(e) => setEditRadius(Number(e.target.value))}
                    className="range-slider"
                  />
                </div>
                <div className="btn-group">
                  <button className="btn btn-primary btn-sm" style={{ flex: 1 }} onClick={handleSaveSafeZone}>저장</button>
                  <button className="btn btn-secondary btn-sm" style={{ flex: 1 }} onClick={handleEditToggle}>취소</button>
                  {manualSafeZone && (
                    <button className="btn btn-danger btn-sm" onClick={handleDeleteSafeZone}>삭제</button>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {isEditingSafeZone && <div className="edit-mode-indicator">지도 클릭하여 위치 지정 중...</div>}

      <div className="map-wrapper">
        <MapContainer center={mapCenter} zoom={13} style={{ height: '100%', width: '100%' }}>
          <MapEvents isEditing={isEditingSafeZone} onMapClick={handleMapClick} />

          <TileLayer
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
          />

          {positionData.map((pos, idx) => (
            <Marker key={idx} position={[pos.lat, pos.lng]}>
              <Popup>시간: {new Date(pos.time).toLocaleString()}</Popup>
            </Marker>
          ))}

          {/* Render detailed path if available, otherwise fallback to simple polyline (though detailedPath should cover all) */}
          {detailedPath.length > 0 && (
            <Polyline positions={detailedPath.map(p => [p.lat, p.lng])} color="blue" />
          )}

          {/* Automatic Safe Zone (Green) - Only show if manual is NOT enabled or during editing comparison */}
          {safeZone && (!manualSafeZone || !manualSafeZone.enabled) && (
            <Circle
              center={[safeZone.center.lat, safeZone.center.lng]}
              radius={safeZone.radius}
              pathOptions={{ color: 'green', fillColor: '#0f0', fillOpacity: 0.1 }}
            >
              <Popup>자동 안심 구역</Popup>
            </Circle>
          )}

          {/* Manual Safe Zone (Blue) */}
          {(manualSafeZone && manualSafeZone.enabled && !isEditingSafeZone) && (
            <Circle
              center={[manualSafeZone.center.lat, manualSafeZone.center.lng]}
              radius={manualSafeZone.radius}
              pathOptions={{ color: 'blue', fillColor: '#00f', fillOpacity: 0.1, dashArray: '5, 10' }}
            >
              <Popup>수동 안심 구역</Popup>
            </Circle>
          )}

          {/* Editing Preview (Dotted Blue) */}
          {isEditingSafeZone && editCenter && (
            <Circle
              center={[editCenter.lat, editCenter.lng]}
              radius={editRadius}
              pathOptions={{ color: 'blue', fillColor: '#00f', fillOpacity: 0.2, dashArray: '10, 10' }}
            />
          )}

          <MapResizer />
        </MapContainer>
      </div>
    </div>
  );
}

export default GuardianView;

// Force re-bundle again and again
