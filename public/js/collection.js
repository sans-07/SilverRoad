import { initAnsimView } from './ansim-view.js';
import { initGuardianView } from './guardian-view.js';

import { firebaseConfig } from './firebase-config.js';
firebase.initializeApp(firebaseConfig);
const db = firebase.firestore();
const auth = firebase.auth();

let currentUser = null;

// --- 인증 상태 감시 ---
auth.onAuthStateChanged(user => {
  if (user) {
    currentUser = user;
    document.getElementById('user-email').innerText = `로그인: ${user.email}`;

    // Firestore에서 사용자 역할 정보 가져오기
    const userDocRef = db.collection('users').doc(user.uid);
    userDocRef.get().then((doc) => {
      if (doc.exists) {
        const userData = doc.data();
        const role = userData.role;

        if (role === 'ansim') {
          // 안심이용 화면 표시
          document.getElementById('ansim-view').style.display = 'block';
          document.querySelector('h2').innerText = '본인 위치 기록'; // Use '본인'
          initAnsimView(db, currentUser); // 안심이 화면 초기화
        } else if (role === 'guardian') {
          // 보호자용 화면 표시
          document.getElementById('guardian-view').style.display = 'block';
          document.querySelector('h2').innerText = '보호자 대시보드';
          initGuardianView(db, currentUser); // 보호자 화면 초기화
        } else {
          // 역할이 없는 경우 (기본값을 안심이로 설정)
          alert('사용자 역할이 지정되지 않았습니다. 기본 화면을 표시합니다.');
          document.getElementById('ansim-view').style.display = 'block';
          initAnsimView(db, currentUser);
        }
      } else {
        console.error("No such user document!");
        alert("사용자 정보를 찾을 수 없습니다.");
        auth.signOut();
      }
    }).catch((error) => {
      console.error("Error getting user document:", error);
    });

  } else {
    // 로그아웃 상태이면 로그인 페이지로 이동
    window.location.href = 'login.html';
  }
});

// --- 로그아웃 공통 이벤트 ---
document.getElementById("logout").addEventListener("click", () => {
  auth.signOut();
});
