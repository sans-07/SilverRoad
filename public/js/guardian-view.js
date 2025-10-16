export function initGuardianView(db, currentUser) {
  const requestsListDiv = document.getElementById('requests-list');
  const ansimsListDiv = document.getElementById('ansim-list');
  const alertsListDiv = document.getElementById('alerts-list');

  // 보호자용 지도 초기화
  const guardianMap = L.map('guardian-map').setView([37.5665, 126.9780], 10);
  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    maxZoom: 19,
    attribution: '© OpenStreetMap'
  }).addTo(guardianMap);

  // --- 새로운 연결 요청 실시간 감지 ---
  db.collection('connectionRequests')
    .where('guardianUid', '==', currentUser.uid)
    .where('status', '==', 'pending')
    .onSnapshot(snapshot => {
      if (snapshot.empty) {
        requestsListDiv.innerHTML = '<p>새로운 요청이 없습니다.</p>';
        return;
      }

      let requestsHtml = '';
      snapshot.forEach(doc => {
        const request = doc.data();
        requestsHtml += `
          <div class="request-item">
            <span>${request.ansimEmail} 님이 연결을 요청했습니다.</span>
            <button class="accept-btn" data-request-id="${doc.id}" data-ansim-uid="${request.ansimUid}">수락</button>
          </div>
        `;
      });
      requestsListDiv.innerHTML = requestsHtml;
    });

  // --- 요청 수락 이벤트 처리 (이벤트 위임) ---
  requestsListDiv.addEventListener('click', (event) => {
    if (event.target.classList.contains('accept-btn')) {
      const button = event.target;
      const requestId = button.dataset.requestId;
      const ansimUid = button.dataset.ansimUid;
      acceptConnectionRequest(requestId, ansimUid);
    }
  });

  // --- 연결된 안심이 목록 실시간 감지 ---
  db.collection('users').doc(currentUser.uid).onSnapshot(async (doc) => {
    const userData = doc.data();
    if (userData && userData.connectedAnsims && userData.connectedAnsims.length > 0) {
      const ansimPromises = userData.connectedAnsims.map(ansimUid => db.collection('users').doc(ansimUid).get());
      const ansimDocs = await Promise.all(ansimPromises);

      let ansimsHtml = ansimDocs.map(ansimDoc => {
        if (ansimDoc.exists) {
          return `<p>${ansimDoc.data().email}</p>`;
        }
        return '';
      }).join('');

      ansimsListDiv.innerHTML = ansimsHtml;
    } else {
      ansimsListDiv.innerHTML = '<p>연결된 안심이가 없습니다.</p>';
    }
  });

  // --- 새로운 알림 실시간 감지 ---
  const ansimInfoCache = {}; // 안심이 정보를 캐시하여 불필요한 DB 조회를 줄임
  let alertMarkers = []; // 알림 마커들을 저장하는 배열

  const orangeIcon = new L.Icon({
    iconUrl: 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-orange.png',
    shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/0.7.7/images/marker-shadow.png',
    iconSize: [25, 41],
    iconAnchor: [12, 41],
    popupAnchor: [1, -34],
    shadowSize: [41, 41]
  });

  db.collection('alerts')
    .where('guardianUid', '==', currentUser.uid)
    .where('status', '==', 'new')
    .orderBy('createdAt', 'desc')
    .onSnapshot(async snapshot => {
      // 기존 알림 마커 모두 제거
      alertMarkers.forEach(marker => guardianMap.removeLayer(marker));
      alertMarkers = [];

      if (snapshot.empty) {
        alertsListDiv.innerHTML = '<p>새로운 알림이 없습니다.</p>';
        return;
      }

      const alertPromises = snapshot.docs.map(async (doc, index) => {
        const alert = doc.data();
        let ansimEmail = ansimInfoCache[alert.ansimUid];

        if (!ansimEmail) {
          const ansimDoc = await db.collection('users').doc(alert.ansimUid).get();
          if (ansimDoc.exists) {
            ansimEmail = ansimDoc.data().email;
            ansimInfoCache[alert.ansimUid] = ansimEmail; // 캐시에 저장
          }
        }

        // 지도에 알림 마커 추가
        const alertLocation = [alert.location.lat, alert.location.lng];
        const marker = L.marker(alertLocation, { icon: orangeIcon })
          .addTo(guardianMap)
          .bindPopup(`${ansimEmail}님의 이탈 지점<br>${new Date(alert.time).toLocaleString('ko-KR')}`);
        alertMarkers.push(marker);

        // 가장 최신 알림 위치로 지도 이동
        if (index === 0) {
          guardianMap.setView(alertLocation, 14);
          marker.openPopup();
        }

        return `
          <div class="alert-item">
            <span><strong>${ansimEmail}</strong> 님이 안심존을 이탈했습니다. (${new Date(alert.time).toLocaleString('ko-KR')})</span>
            <button class="ack-btn" data-alert-id="${doc.id}">확인</button>
          </div>
        `;
      });

      const alertsHtml = await Promise.all(alertPromises);
      alertsListDiv.innerHTML = alertsHtml.join('');
    });

  // --- 알림 확인 이벤트 처리 ---
  alertsListDiv.addEventListener('click', (event) => {
    if (event.target.classList.contains('ack-btn')) {
      const alertId = event.target.dataset.alertId;
      db.collection('alerts').doc(alertId).update({ status: 'acknowledged' });
    }
  });

  // --- 연결 요청 수락 함수 ---
  async function acceptConnectionRequest(requestId, ansimUid) {
    const requestRef = db.collection('connectionRequests').doc(requestId);
    const ansimRef = db.collection('users').doc(ansimUid);
    const guardianRef = db.collection('users').doc(currentUser.uid);

    try {
      await db.runTransaction(async (transaction) => {
        // 1. 요청 문서의 상태를 'accepted'로 변경
        transaction.update(requestRef, { status: 'accepted' });

        // 2. 안심이 문서에 guardianId 추가
        transaction.update(ansimRef, { guardianId: currentUser.uid });

        // 3. 보호자 문서의 connectedAnsims 배열에 안심이 UID 추가
        transaction.update(guardianRef, {
          connectedAnsims: firebase.firestore.FieldValue.arrayUnion(ansimUid)
        });
      });

      alert('연결을 수락했습니다.');
    } catch (error) {
      console.error("Transaction failed: ", error);
      alert('요청 수락 중 오류가 발생했습니다.');
    }
  }
}
