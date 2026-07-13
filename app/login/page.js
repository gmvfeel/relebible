'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '../../lib/supabaseClient';

export default function LoginPage() {
  const [mode, setMode] = useState('login'); // 'login' 또는 'signup'
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  const supabase = createClient();

  // 이미 로그인돼 있으면 홈으로 보내기
  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      if (data?.user) router.push('/');
    });
  }, []);

  const handleSubmit = async () => {
    setMessage('');
    if (!email || !password) {
      setMessage('이메일과 비밀번호를 모두 입력해 주세요.');
      return;
    }
    setLoading(true);

    if (mode === 'signup') {
      const { error } = await supabase.auth.signUp({ email, password });
      setLoading(false);
      if (error) {
        setMessage('가입 중 문제가 생겼어요: ' + error.message);
      } else {
        setMessage('가입 확인 메일을 보냈어요. 메일함을 확인해 주세요!');
      }
    } else {
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      setLoading(false);
      if (error) {
        setMessage('로그인에 실패했어요. 이메일과 비밀번호를 확인해 주세요.');
      } else {
        router.push('/');
      }
    }
  };

  return (
    <div className="auth-container">
      <div className="auth-box">
        <h1 className="auth-logo">R<span className="sun-e">e</span>leBible</h1>
        <p className="auth-subtitle">매일 조금씩, 다시 읽는 성경</p>

        <div className="auth-tabs">
          <button
            className={mode === 'login' ? 'auth-tab active' : 'auth-tab'}
            onClick={() => { setMode('login'); setMessage(''); }}
          >
            로그인
          </button>
          <button
            className={mode === 'signup' ? 'auth-tab active' : 'auth-tab'}
            onClick={() => { setMode('signup'); setMessage(''); }}
          >
            회원가입
          </button>
        </div>

        <div className="auth-field">
          <label>이메일</label>
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="you@example.com"
          />
        </div>

        <div className="auth-field">
          <label>비밀번호</label>
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="비밀번호"
          />
        </div>

        <button className="auth-submit" onClick={handleSubmit} disabled={loading}>
          {loading ? '처리 중...' : (mode === 'login' ? '로그인' : '가입하기')}
        </button>

        {message && <p className="auth-message">{message}</p>}

        <a href="/" className="auth-back">← 오늘의 말씀으로 돌아가기</a>
      </div>
    </div>
  );
}
