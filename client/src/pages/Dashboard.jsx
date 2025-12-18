import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { db } from '../firebase-init';
import AnsimView from './AnsimView';
import GuardianView from './GuardianView';
import '../components/Button.css';

function Dashboard() {
  const { currentUser, logout } = useAuth();
  const [userRole, setUserRole] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const handleLogout = async () => {
    try {
      await logout();
    } catch {
      setError('로그아웃에 실패했습니다.');
    }
  };

  useEffect(() => {
    if (currentUser) {
      const userDocRef = db.collection('users').doc(currentUser.uid);
      const unsubscribe = userDocRef.onSnapshot((doc) => {
        if (doc.exists) {
          setUserRole(doc.data().role);
        } else {
          setError('사용자 데이터를 찾을 수 없습니다.');
        }
        setLoading(false);
      }, (err) => {
        console.error(err);
        setError('데이터를 불러오는 중 오류가 발생했습니다.');
        setLoading(false);
      });

      return () => unsubscribe();
    }
  }, [currentUser]);

  if (loading) {
    return (
      <div className="flex-center h-full" style={{ minHeight: '100vh' }}>
        <div className="spinner">로딩 중...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex-center h-full" style={{ minHeight: '100vh', flexDirection: 'column', gap: '1rem' }}>
        <div style={{ color: 'var(--color-danger)' }}>{error}</div>
        <button className="btn btn-secondary" onClick={handleLogout}>로그아웃</button>
      </div>
    );
  }

  return (
    <div className="dashboard-layout" style={{ display: 'flex', flexDirection: 'column', height: '100vh' }}>
      {/* Header / Navigation */}
      <header style={{
        padding: '16px 24px',
        backgroundColor: 'var(--color-bg-card)',
        borderBottom: '1px solid var(--color-secondary-light)',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        boxShadow: 'var(--shadow-sm)',
        zIndex: 10
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <h1 style={{ fontSize: '1.25rem', fontWeight: 800, color: 'var(--color-primary)' }}>SAI(Safe With AI)로드</h1>
          <span style={{
            fontSize: '0.875rem',
            padding: '4px 8px',
            borderRadius: '12px',
            backgroundColor: userRole === 'ansim' ? 'var(--color-success)' : 'var(--color-info)',
            color: 'white',
            fontWeight: 600
          }}>
            {userRole === 'ansim' ? '안심이' : '보호자'}
          </span>
        </div>
        <button className="btn btn-secondary" style={{ padding: '8px 16px', fontSize: '0.875rem' }} onClick={handleLogout}>
          로그아웃
        </button>
      </header>

      {/* Main Content Area */}
      <main style={{ flexGrow: 1, position: 'relative', overflow: 'hidden' }}>
        {userRole === 'ansim' && <AnsimView />}
        {userRole === 'guardian' && <GuardianView />}
        {!userRole && (
          <div className="flex-center h-full">역할이 지정되지 않은 사용자입니다.</div>
        )}
      </main>
    </div>
  );
}

export default Dashboard;

