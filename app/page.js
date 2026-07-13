'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '../lib/supabaseClient';

export default function Home() {
  const [theme, setTheme] = useState('dark');
  const [todayDate, setTodayDate] = useState('');
  const [user, setUser] = useState(null);
  const [completedToday, setCompletedToday] = useState(false);
  const [totalDays, setTotalDays] = useState(0);
  const [saving, setSaving] = useState(false);

  const router = useRouter();
  const supabase = createClient();

  // 오늘 날짜를 YYYY-MM-DD 형태로 (저장용)
  const getTodayString = () => {
    const now = new Date();
    const y = now.getFullYear();
    const m = String(now.getMonth() + 1).padStart(2, '0');
    const d = String(now.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
  };

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
  }, [theme]);

  useEffect(() => {
    const months = ['JAN','FEB','MAR','APR','MAY','JUN','JUL','AUG','SEP','OCT','NOV','DEC'];
    const now = new Date();
    setTodayDate(months[now.getMonth()] + ' ' + now.getDate());
  }, []);

  // 로그인 상태 확인
  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      setUser(data?.user ?? null);
    });
    const { data: listener } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
    });
    return () => listener.subscription.unsubscribe();
  }, []);

  // 로그인한 사용자의 읽기 기록 불러오기
  useEffect(() => {
    if (!user) {
      setCompletedToday(false);
      setTotalDays(0);
      return;
    }
    loadProgress();
  }, [user]);

  const loadProgress = async () => {
    // 지금까지 읽은 총 일수
    const { count } = await supabase
      .from('rb_reading_progress')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', user.id);
    setTotalDays(count ?? 0);

    // 오늘 읽었는지 확인
    const { data } = await supabase
      .from('rb_reading_progress')
      .select('id')
      .eq('user_id', user.id)
      .eq('read_date', getTodayString());
    setCompletedToday((data?.length ?? 0) > 0);
  };

  const toggleTheme = () => {
    setTheme(theme === 'dark' ? 'light' : 'dark');
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
    setUser(null);
  };

  // 오늘 읽기 완료 버튼
  const handleComplete = async () => {
    // 로그인 안 했으면 로그인 화면으로
    if (!user) {
      router.push('/login');
      return;
    }
    // 이미 완료했으면 아무것도 안 함
    if (completedToday) return;

    setSaving(true);
    const { error } = await supabase
      .from('rb_reading_progress')
      .insert({
        user_id: user.id,
        read_date: getTodayString(),
        reference: '요한복음 3:16',
        completed: true,
      });
    setSaving(false);

    if (!error) {
      setCompletedToday(true);
      setTotalDays(totalDays + 1);
    } else {
      alert('저장 중 문제가 생겼어요. 잠시 후 다시 시도해 주세요.');
    }
  };

  return (
    <div className="container">
      <div className="topbar">
        <span className="logo">relebible</span>
        <div className="topbar-right">
          {user ? (
            <>
              <span className="user-email">{user.email}</span>
              <button className="theme-toggle" onClick={handleLogout}>
                로그아웃
              </button>
            </>
          ) : (
            <button className="theme-toggle" onClick={() => router.push('/login')}>
              로그인
            </button>
          )}
          <button className="theme-toggle" onClick={toggleTheme}>
            <span>{theme === 'dark' ? '☀️' : '🌙'}</span>
            <span>{theme === 'dark' ? '라이트' : '다크'}</span>
          </button>
        </div>
      </div>

      <div className="date-header">
        <div>
          <div className="date">{todayDate}</div>
        </div>
        <div className="day-count">
          {user ? (
            <>통독 <span className="day-num">{totalDays}</span>일째</>
          ) : (
            '로그인하면 진도가 기록돼요'
          )}
        </div>
      </div>

      <div className="ref">요한복음 3:16</div>

      <div className="verse-grid">
        <div className="verse-col">
          <div className="verse-tag">개역한글</div>
          <div className="kr">
            하나님이 세상을 이처럼 사랑하사 독생자를 주셨으니 이는 저를 믿는 자마다 멸망치 않고 영생을 얻게 하려 하심이니라
          </div>
        </div>
        <div className="divider"></div>
        <div className="verse-col">
          <div className="verse-tag">KJV</div>
          <div className="en">
            For God so loved the world, that he gave his only begotten Son, that whosoever believeth in him should not perish, but have everlasting life.
          </div>
        </div>
      </div>

      <div className="interp-box">
        <div className="interp-title">오늘의 쉬운 풀이</div>
        <div className="interp-body">
          하나님이 우리를 얼마나 사랑하시는지를 보여주는 구절이에요. 그 사랑이 말로 그친 게 아니라, 가장 귀한 것(아들)을 내어주실 만큼 컸다는 뜻이에요.
        </div>
      </div>

      <div className="footer-nav">
        <button className="nav-btn">← 어제</button>
        <button
          className={completedToday ? 'nav-btn done' : 'nav-btn'}
          onClick={handleComplete}
          disabled={saving}
        >
          {saving
            ? '저장 중...'
            : completedToday
              ? '오늘 읽기 완료됨 ✓'
              : '오늘 읽기 완료'}
        </button>
        <button className="nav-btn">내일 →</button>
      </div>
    </div>
  );
}
