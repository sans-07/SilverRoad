import React from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

function ProtectedRoute({ children }) {
  const { currentUser, loading } = useAuth();

  if (loading) {
    return <div>로딩 중...</div>; // 인증 상태 확인 중에는 로딩 표시
  }

  if (!currentUser) {
    // 사용자가 로그인하지 않았으면 로그인 페이지로 리디렉션
    return <Navigate to="/login" />;
  }

  // 로그인했다면 요청된 페이지를 보여줌
  return children;
}

export default ProtectedRoute;
