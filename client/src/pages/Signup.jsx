import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { auth, db, firebase } from '../firebase-init';
import '../components/Card.css';
import '../components/Button.css';
import './Login.css'; // Reuse login page layout styles

function Signup() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [role, setRole] = useState('ansim');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  const handleSignup = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const userCredential = await auth.createUserWithEmailAndPassword(email, password);
      const user = userCredential.user;

      await db.collection('users').doc(user.uid).set({
        email: email,
        role: role,
        createdAt: firebase.firestore.FieldValue.serverTimestamp()
      });

      navigate('/login');
    } catch (err) {
      console.error("Signup error:", err);
      setError(`회원가입 실패: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="login-page">
      <div className="card login-card">
        <h1 className="brand-title">SAI(Safe With AI)로드</h1>
        <p className="subtitle">새 계정 만들기</p>

        <form onSubmit={handleSignup}>
          <div className="input-group">
            <label className="input-label">이메일</label>
            <input
              type="email"
              className="input-field"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="name@example.com"
              required
            />
          </div>

          <div className="input-group">
            <label className="input-label">비밀번호</label>
            <input
              type="password"
              className="input-field"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="비밀번호 (6자 이상)"
              required
            />
          </div>

          <div className="input-group">
            <label className="input-label">역할 선택</label>
            <div className="role-selector-container">
              <label className={`role-option ${role === 'ansim' ? 'selected' : ''}`}>
                <input
                  type="radio"
                  name="role"
                  value="ansim"
                  checked={role === 'ansim'}
                  onChange={(e) => setRole(e.target.value)}
                  className="hidden-radio"
                />
                <span className="role-text">안심이 (보호 대상)</span>
              </label>
              <label className={`role-option ${role === 'guardian' ? 'selected' : ''}`}>
                <input
                  type="radio"
                  name="role"
                  value="guardian"
                  checked={role === 'guardian'}
                  onChange={(e) => setRole(e.target.value)}
                  className="hidden-radio"
                />
                <span className="role-text">보호자 (모니터링)</span>
              </label>
            </div>
          </div>

          {error && <div className="input-error text-center" style={{ marginBottom: '16px' }}>{error}</div>}

          <button type="submit" className="btn btn-primary btn-block" disabled={loading}>
            {loading ? '가입 중...' : '회원가입'}
          </button>
        </form>

        <div className="auth-links">
          <p>이미 계정이 있으신가요? <Link to="/login">로그인</Link></p>
        </div>
      </div>
    </div>
  );
}

export default Signup;
