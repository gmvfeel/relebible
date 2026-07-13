'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '../lib/supabaseClient';
import InstallBanner from './InstallBanner';

export default function Home() {
  const [theme, setTheme] = useState('dark');
  const [todayDate, setTodayDate] = useState('');
  const [user, setUser] = useState(null);
  const [completedToday, setCompletedToday] = useState(false);
  const [totalDays, setTotalDays] = useState(0);
  const [saving, setSaving] = useState(false);

  // 오늘 읽을 본문 (수파베이스에서 불러옴)
  const [verse, setVerse] = useState(null);
  const [loadingVerse, setLoadingVerse] = useState(true);

  const router = useRouter();
  const supabase = createClient();

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

  // 오늘의 본문 불러오기 (지금은 창세기 1장 1절로 연결 확인)
  useEffect(() => {
    loadVerse();
  }, []);

  const loadVerse = async () => {
    setLoadingVerse(true);
    const { data, error } = await supabase
      .from('rb_bible_verses')
      .select('book_ko, book_en, chapter, verse, text_ko, text_en')
      .eq('book_order', 1)   // 창세기
      .eq('chapter', 1)      // 1장
      .eq('verse', 1)        // 1절
      .single();

    if (!error && data) {
      setVerse(data);
    }
    setLoadingVerse(false);
  };

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
    const { count } = await supabase
      .from('rb_reading_progress')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', user.id);
    setTotalDays(count ?? 0);

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

  const handleComplete = async () => {
    if (!user) {
      router.push('/login');
      return;
    }
    if (completedToday) return;

    setSaving(true);
    const refText = verse ? `${verse.book_ko} ${verse.chapter}:${verse.verse}` : '';
    const { error } = await supabase
      .from('rb_reading_progress')
      .insert({
        user_id: user.id,
        read_date: getTodayString(),
        reference: refText,
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

  // 본문 참조 표시 (예: 창세기 1:1)
  const refLabel = verse ? `${verse.book_ko} ${verse.chapter}:${verse.verse}` : '';

  return (
    <div className="container">
      <div className="topbar">
        <span className="logo">R<span className="sun-e">e</span>leBible</span>
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

      {loadingVerse ? (
        <div className="ref">본문을 불러오는 중...</div>
      ) : verse ? (
        <>
          <div className="ref">{refLabel}</div>

          <div className="verse-grid">
            <div className="verse-col">
              <div className="verse-tag">개역한글</div>
              <div className="kr">{verse.text_ko}</div>
            </div>
            <div className="divider"></div>
            <div className="verse-col">
              <div className="verse-tag">KJV</div>
              <div className="en">{verse.text_en}</div>
            </div>
          </div>
        </>
      ) : (
        <div className="ref">본문을 불러오지 못했어요</div>
      )}

      <div className="interp-box">
        <div className="interp-title">오늘의 쉬운 풀이</div>
        <div className="interp-body">
          (쉬운 풀이는 다음 단계에서 추가할 예정이에요.)
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

      <InstallBanner />
    </div>
  );
}
