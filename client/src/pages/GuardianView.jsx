import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { MapContainer, TileLayer, Marker, Popup, Polyline } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import './GuardianView.css';
import '../components/Button.css';
import '../components/Card.css';
import MapResizer from '../components/MapResizer';
import GuardianControls from '../components/GuardianControls';
import { useGuardianData } from '../hooks/useGuardianData';

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

  // AI Summary state (kept in view for now as it's UI specific logic, or could be moved to hook if data related)
  const [isGeneratingSummary, setIsGeneratingSummary] = useState(false);
  const [summaryData, setSummaryData] = useState(null);

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

          <Polyline positions={positionData.map(p => [p.lat, p.lng])} color="blue" />

          <MapResizer />
        </MapContainer>
      </div>
    </div>
  );
}

export default GuardianView;

// Force re-bundle again and again
