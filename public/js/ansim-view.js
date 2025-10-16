export function initAnsimView(db, currentUser) {
  let userLocationsCollection = db.collection('users').doc(currentUser.uid).collection('locations');

  // --- 지도 초기화 ---
  var map = L.map('map').setView([37.5665, 126.9780], 13);
  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    maxZoom: 19,
    attribution: '© OpenStreetMap'
  }).addTo(map);

  let positionData = [];
  let polyline = L.polyline([], { color: 'blue' }).addTo(map);
  let intervalId = null;

  // --- DB에서 기존 기록 불러오기 및 통계 표시 ---
  function loadInitialData() {
    if (!userLocationsCollection) return;

    // 현재 위치 표시
    showCurrentLocation();

    // 기존 경로 초기화
    positionData = [];
    polyline.setLatLngs([]);
    map.eachLayer(layer => {
      if (layer instanceof L.Marker || layer instanceof L.Polyline) {
        // Do not remove the tile layer
        if (layer instanceof L.TileLayer == false) {
          map.removeLayer(layer);
        }
      }
    });
    polyline = L.polyline([], { color: 'blue' }).addTo(map);


    // DB에서 기록 불러오기
    userLocationsCollection.orderBy("time").get().then(snapshot => {
      snapshot.forEach(doc => {
        const data = doc.data();
        positionData.push(data);
        polyline.addLatLng([data.lat, data.lng]);
        L.marker([data.lat, data.lng]).addTo(map)
          .bindPopup(`시간: ${data.time}`);
      });

      // 통계 불러오기
      displayTop5Stats();
    });
  }

  // 위치 한 번 수집
  async function collectPosition() {
    if (!currentUser) return;
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        async (pos) => {
          const lat = pos.coords.latitude;
          const lng = pos.coords.longitude;
          const time = new Date().toISOString();

          const point = { time, lat, lng };
          positionData.push(point);

          polyline.addLatLng([lat, lng]);
          L.marker([lat, lng]).addTo(map).bindPopup(`시간: ${time}`).openPopup();
          map.setView([lat, lng], 15);

          document.getElementById("status").innerText = `마지막 기록: ${time} / 위도:${lat}, 경도:${lng}`;

          // 사용자별 DB에 저장 (백엔드 API 호출로 변경)
          try {
            const idToken = await currentUser.getIdToken(true);
            const response = await fetch('/api/locations', {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${idToken}`
              },
              body: JSON.stringify(point)
            });
            if (!response.ok) {
              throw new Error('Server responded with an error');
            }
            const data = await response.json();
            console.log("Location saved via server:", data.message);
          } catch (err) {
            console.error("API 호출 오류:", err);
          }
        },
        (err) => {
          console.error("위치 오류:", err.message);
        }
      );
    } else {
      alert("이 브라우저는 위치 정보를 지원하지 않습니다.");
    }
  }

  // CSV 변환 + 다운로드
  function downloadCSV() {
    if (positionData.length === 0) {
      alert("저장할 데이터가 없습니다.");
      return;
    }
    let csv = "time,latitude,longitude\n";
    positionData.forEach(row => {
      csv += `${row.time},${row.lat},${row.lng}\n`;
    });
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "location_data.csv";
    a.click();
    URL.revokeObjectURL(url);
  }

  // 현재 위치 한 번 표시 함수
  function showCurrentLocation() {
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          const lat = pos.coords.latitude;
          const lng = pos.coords.longitude;

          const greenIcon = new L.Icon({
            iconUrl: 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-green.png',
            shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/0.7.7/images/marker-shadow.png',
            iconSize: [25, 41],
            iconAnchor: [12, 41],
            popupAnchor: [1, -34],
            shadowSize: [41, 41]
          });

          L.marker([lat, lng], { icon: greenIcon }).addTo(map)
            .bindPopup('<b>현재 위치</b>')
            .openPopup();
          map.setView([lat, lng], 15);
        },
        () => {
          // 에러 발생 시 기본 위치(서울)로 설정
          map.setView([37.5665, 126.9780], 13);
        }
      );
    }
  }

  // TOP 5 통계 마커 표시 함수
  async function displayTop5Stats() {
    if (!currentUser) return;
    try {
      const idToken = await currentUser.getIdToken(true);
      const response = await fetch('http://localhost:3000/api/stats', {
        headers: {
          'Authorization': `Bearer ${idToken}`
        }
      });

      if (!response.ok) {
        throw new Error(`Server error: ${response.statusText}`);
      }

      const analysisResult = await response.json();
      const stats = analysisResult.top5; // 서버 응답 구조 변경에 따라 top5 배열을 직접 가져옴

      if (!stats || !Array.isArray(stats)) {
        console.log('통계 데이터가 배열이 아닙니다.', stats);
        return;
      }

      const redIcon = new L.Icon({
        iconUrl: 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-red.png',
        shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/0.7.7/images/marker-shadow.png',
        iconSize: [25, 41],
        iconAnchor: [12, 41],
        popupAnchor: [1, -34],
        shadowSize: [41, 41]
      });

      // --- 안심존 시각화 ---
      if (analysisResult.safeZone) {
        const { center, radius } = analysisResult.safeZone;
        L.circle([center.lat, center.lng], {
          color: 'green',
          fillColor: '#0f0',
          fillOpacity: 0.2,
          radius: radius
        }).addTo(map).bindPopup('안심 영역');
      }

      stats.forEach((item, index) => {
        const rank = index + 1;
        const { lat, lng } = item.location;
        const count = item.visitCount;
        const lastVisit = new Date(item.lastVisitTime).toLocaleString('ko-KR');

        L.marker([lat, lng], { icon: redIcon })
          .addTo(map)
          .bindPopup(`<b>자주 가는 곳 TOP ${rank}</b><br>방문 횟수: ${count}회<br>마지막 방문: ${lastVisit}`)
          .openPopup();
      });
    } catch (error) {
      console.error('통계 데이터 로딩 오류:', error);
    }
  }

  // 버튼 이벤트
  document.getElementById("start").addEventListener("click", () => {
    if (!intervalId) {
      collectPosition();
      intervalId = setInterval(collectPosition, 30000);
      document.getElementById("status").innerText = "상태: 수집 시작됨";
    }
  });
  document.getElementById("stop").addEventListener("click", () => {
    if (intervalId) {
      clearInterval(intervalId);
      intervalId = null;
      document.getElementById("status").innerText = "상태: 수집 중지됨";
    }
  });
  document.getElementById("download").addEventListener("click", downloadCSV);

  // --- 보호자 연결 요청 보내기 ---
  document.getElementById('send-request-btn').addEventListener('click', sendConnectionRequest);

  // --- 연결 상태 확인 및 UI 업데이트 ---
  async function checkConnectionStatus() {
    const userDoc = await db.collection('users').doc(currentUser.uid).get();
    const connectionStatusEl = document.getElementById('connection-status');
    const requestDiv = document.getElementById('connection-management');

    if (userDoc.exists && userDoc.data().guardianId) {
      // 이미 보호자와 연결된 경우
      const guardianDoc = await db.collection('users').doc(userDoc.data().guardianId).get();
      connectionStatusEl.innerText = `연결됨 (${guardianDoc.data().email})`;
      requestDiv.style.display = 'none'; // 연결 관리 섹션 숨기기
      return;
    }

    // 보낸 요청이 있는지 확인
    const requestSnapshot = await db.collection('connectionRequests').where('ansimUid', '==', currentUser.uid).where('status', '==', 'pending').get();
    if (!requestSnapshot.empty) {
      // 보낸 요청이 있고 아직 수락 대기 중인 경우
      connectionStatusEl.innerText = '요청 보냄 (수락 대기중)';
      document.getElementById('guardian-email-input').disabled = true;
      document.getElementById('send-request-btn').disabled = true;
    } else {
      connectionStatusEl.innerText = '연결되지 않음';
    }
  }

  // --- 연결 요청 전송 함수 ---
  async function sendConnectionRequest() {
    const guardianEmail = document.getElementById('guardian-email-input').value;
    if (!guardianEmail) {
      alert('보호자 이메일을 입력해주세요.');
      return;
    }

    // 1. 이메일로 보호자 사용자 찾기
    const usersRef = db.collection('users');
    const snapshot = await usersRef.where('email', '==', guardianEmail).where('role', '==', 'guardian').get();

    if (snapshot.empty) {
      alert('해당 이메일을 가진 보호자 사용자를 찾을 수 없습니다.');
      return;
    }

    // 2. 보호자 정보 가져오기 (첫 번째 매칭된 사용자)
    const guardian = snapshot.docs[0];
    const guardianUid = guardian.id;

    // 3. connectionRequests 컬렉션에 요청 문서 생성
    const requestsRef = db.collection('connectionRequests');
    try {
      await requestsRef.add({
        ansimUid: currentUser.uid,
        ansimEmail: currentUser.email,
        guardianUid: guardianUid,
        status: 'pending',
        requestedAt: firebase.firestore.FieldValue.serverTimestamp()
      });
      alert('연결 요청을 보냈습니다. 보호자가 수락하면 연결이 완료됩니다.');
      checkConnectionStatus(); // 상태 즉시 업데이트
    } catch (error) {
      console.error("Error sending connection request: ", error);
      alert('요청을 보내는 중 오류가 발생했습니다.');
    }
  }

  // 초기 데이터 로드
  loadInitialData();
  checkConnectionStatus(); // 연결 상태 확인
}
