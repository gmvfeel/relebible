'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '../lib/supabaseClient';
import InstallBanner from './InstallBanner';

export default function Home() {
  const [theme, setTheme] = useState('dark');
  const [todayDate, setTodayDate] = useState('');
  const [user, setUser] = useState(null);
  const [authChecked, setAuthChecked] = useState(false);
  const [completedToday, setCompletedToday] = useState(false);
  const [totalDays, setTotalDays] = useState(0);
  const [saving, setSaving] = useState(false);

  // 읽기 계획 & 분량
  const [plan, setPlan] = useState(null);          // 활성 계획
  const [verses, setVerses] = useState([]);        // 보고 있는 날의 절들
  const [dayNumber, setDayNumber] = useState(0);   // 보고 있는 날이 며칠째인지
  const [viewOffset, setViewOffset] = useState(0); // 오늘=0, 어제=-1, 내일=+1
  const [loading, setLoading] = useState(true);

  const router = useRouter();
  const supabase = createClient();

  // 한국 시간(KST) 기준 오늘 날짜 (YYYY-MM-DD)
  const getTodayString = () => {
    const kst = new Date(Date.now() + 9 * 60 * 60 * 1000);
    const y = kst.getUTCFullYear();
    const m = String(kst.getUTCMonth() + 1).padStart(2, '0');
    const d = String(kst.getUTCDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
  };

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
  }, [theme]);

  useEffect(() => {
    const kst = new Date(Date.now() + 9 * 60 * 60 * 1000);
    setTodayDate(`${kst.getUTCMonth() + 1}월 ${kst.getUTCDate()}일`);
  }, []);

  // 로그인 상태 확인
  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      setUser(data?.user ?? null);
      setAuthChecked(true);
    });
    const { data: listener } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
    });
    return () => listener.subscription.unsubscribe();
  }, []);

  // 로그인되면 계획 + 진도 불러오기
  useEffect(() => {
    if (!authChecked) return;
    if (!user) {
      setLoading(false);
      return;
    }
    loadEverything();
  }, [authChecked, user]);

  // 두 날짜(YYYY-MM-DD) 사이의 일수 차이
  const daysBetween = (startStr, todayStr) => {
    const s = new Date(startStr + 'T00:00:00Z');
    const t = new Date(todayStr + 'T00:00:00Z');
    return Math.floor((t - s) / (1000 * 60 * 60 * 24));
  };

  const loadEverything = async () => {
    setLoading(true);

    // 1) 진도(총 일수, 오늘 완료 여부)
    const { count } = await supabase
      .from('rb_reading_progress')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', user.id);
    setTotalDays(count ?? 0);

    const { data: todayDone } = await supabase
      .from('rb_reading_progress')
      .select('id')
      .eq('user_id', user.id)
      .eq('read_date', getTodayString());
    setCompletedToday((todayDone?.length ?? 0) > 0);

    // 2) 활성 읽기 계획
    const { data: plans } = await supabase
      .from('rb_reading_plan')
      .select('*')
      .eq('user_id', user.id)
      .eq('is_active', true)
      .order('created_at', { ascending: false })
      .limit(1);

    const activePlan = plans?.[0] ?? null;
    setPlan(activePlan);

    if (activePlan) {
      await loadTodayVerses(activePlan, viewOffset);
    }
    setLoading(false);
  };

  // 어제/내일 버튼으로 오프셋이 바뀌면 본문 다시 불러오기
  useEffect(() => {
    if (plan) {
      loadTodayVerses(plan, viewOffset);
    }
  }, [viewOffset]);

  // 계획을 바탕으로 (보고 있는 날의) 읽을 절들 계산해서 가져오기
  const loadTodayVerses = async (activePlan, offset = 0) => {
    const perDay = activePlan.verses_per_day;
    const passedToday = Math.max(0, daysBetween(activePlan.start_date, getTodayString()));
    const passedDays = passedToday + offset; // 보고 있는 날 기준
    setDayNumber(passedDays + 1);

    // 시작일보다 이전이면 빈 결과
    if (passedDays < 0) {
      setVerses([]);
      return;
    }

    const skip = passedDays * perDay;

    const { data, error } = await supabase
      .from('rb_bible_verses')
      .select('book_order, book_ko, book_en, chapter, verse, text_ko, text_en')
      .or(
        `book_order.gt.${activePlan.book_order},` +
        `and(book_order.eq.${activePlan.book_order},chapter.gt.${activePlan.start_chapter}),` +
        `and(book_order.eq.${activePlan.book_order},chapter.eq.${activePlan.start_chapter},verse.gte.${activePlan.start_verse})`
      )
      .order('book_order', { ascending: true })
      .order('chapter', { ascending: true })
      .order('verse', { ascending: true })
      .range(skip, skip + perDay - 1);

    if (!error && data) {
      setVerses(data);
    } else {
      setVerses([]);
    }
  };

  const toggleTheme = () => setTheme(theme === 'dark' ? 'light' : 'dark');

  const handleLogout = async () => {
    await supabase.auth.signOut();
    setUser(null);
    setPlan(null);
    setVerses([]);
  };

  const handleComplete = async () => {
    if (!user) {
      router.push('/login');
      return;
    }
    if (completedToday || verses.length === 0) return;

    setSaving(true);
    const first = verses[0];
    const last = verses[verses.length - 1];
    const refText =
      first.chapter === last.chapter
        ? `${first.book_ko} ${first.chapter}:${first.verse}-${last.verse}`
        : `${first.book_ko} ${first.chapter}:${first.verse} - ${last.book_ko} ${last.chapter}:${last.verse}`;

    const { error } = await supabase.from('rb_reading_progress').insert({
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

  // 오늘 분량의 참조 라벨 (예: 시편 1:1-5)
  const refLabel = (() => {
    if (verses.length === 0) return '';
    const first = verses[0];
    const last = verses[verses.length - 1];
    if (first.chapter === last.chapter) {
      return `${first.book_ko} ${first.chapter}:${first.verse}-${last.verse}`;
    }
    return `${first.book_ko} ${first.chapter}:${first.verse} - ${last.book_ko} ${last.chapter}:${last.verse}`;
  })();

  return (
    <div className="container">
      <div className="topbar">
        <span className="logo">R<span className="sun-e">e</span>leBible</span>
        <div className="topbar-right">
          {user ? (
            <>
              <button className="theme-toggle" onClick={() => router.push('/plan')}>
                읽기 계획
              </button>
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
        <div className="date-line">
          <span className="date">{todayDate}</span>
          {user && (
            <>
              <span className="date-sep">·</span>
              <span className="day-count">
                성경읽기 <span className="day-num">{totalDays}</span>일째
              </span>
            </>
          )}
          {!user && (
            <span className="day-count-guide">로그인하면 진도가 기록돼요</span>
          )}
        </div>
      </div>

      {/* 상태에 따라 다르게 표시 */}
      {loading ? (
        <div className="ref">불러오는 중...</div>
      ) : !user ? (
        <div className="empty-state">
          <p className="empty-text">로그인하면 나만의 성경 읽기를 시작할 수 있어요.</p>
          <button className="empty-btn" onClick={() => router.push('/login')}>
            로그인 / 회원가입
          </button>
        </div>
      ) : !plan ? (
        <div className="empty-state">
          <p className="empty-text">
            아직 읽기 계획이 없어요.<br />
            어떤 말씀을, 하루에 얼마씩 읽을지 정해보세요.
          </p>
          <button className="empty-btn" onClick={() => router.push('/plan')}>
            읽기 계획 정하기
          </button>
        </div>
      ) : verses.length === 0 ? (
        <div className="empty-state">
          <p className="empty-text">
            계획하신 분량을 모두 읽으셨어요! 🎉<br />
            새로운 구간을 정해 계속 읽어보세요.
          </p>
          <button className="empty-btn" onClick={() => router.push('/plan')}>
            새 계획 정하기
          </button>
        </div>
      ) : (
        <>
          {verses.length === 0 ? (
            <div className="empty-state">
              <p className="empty-text">
                {viewOffset > 0
                  ? '이 날의 분량이 아직 없어요.\n계획한 구간을 다 읽으면 새 계획을 정할 수 있어요.'
                  : '이 날의 분량이 없어요.'}
              </p>
              {viewOffset !== 0 && (
                <button className="empty-btn" onClick={() => setViewOffset(0)}>
                  오늘로 돌아가기
                </button>
              )}
            </div>
          ) : (
            <>
              <div className="ref">{refLabel}</div>

              <div className="verse-grid">
                <div className="verse-col">
                  <div className="verse-tag">개역한글</div>
                  <div className="passage-ko">
                    {verses.map((v) => (
                      <div key={`ko-${v.book_order}-${v.chapter}-${v.verse}`} className="verse-line-ko">
                        <span className="vnum">{v.verse}</span>
                        {v.text_ko}
                      </div>
                    ))}
                  </div>
                </div>
                <div className="divider"></div>
                <div className="verse-col">
                  <div className="verse-tag">KJV</div>
                  <div className="passage-en">
                    {verses.map((v) => (
                      <div key={`en-${v.book_order}-${v.chapter}-${v.verse}`} className="verse-line-en">
                        <span className="vnum">{v.verse}</span>
                        {v.text_en}
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              {/* 하단: 완료(오늘일 때) + 날짜 네비게이션 */}
              <div className="read-footer">
                {viewOffset === 0 ? (
                  completedToday ? (
                    <div className="read-done">
                      <button className="complete-btn done" disabled>
                        오늘 읽기 완료 ✓
                      </button>
                      <p className="encourage">오늘도 말씀과 함께하셨네요.</p>
                    </div>
                  ) : (
                    <>
                      <p className="today-amount">오늘 읽을 분량 · {verses.length}절</p>
                      <button
                        className="complete-btn"
                        onClick={handleComplete}
                        disabled={saving}
                      >
                        {saving ? '저장 중...' : '오늘 읽기 완료'}
                      </button>
                    </>
                  )
                ) : (
                  <button className="complete-btn done" onClick={() => setViewOffset(0)}>
                    오늘로 돌아가기
                  </button>
                )}

                {/* 날짜 넘김 네비게이션 */}
                <div className="day-nav">
                  <button
                    className="day-nav-btn"
                    onClick={() => setViewOffset(viewOffset - 1)}
                    disabled={dayNumber <= 1}
                  >
                    ← 어제
                  </button>
                  <span className="day-nav-label">
                    {viewOffset === 0 ? '오늘' : `${dayNumber}일째`}
                  </span>
                  <button
                    className="day-nav-btn"
                    onClick={() => setViewOffset(viewOffset + 1)}
                  >
                    내일 →
                  </button>
                </div>
              </div>
            </>
          )}
        </>
      )}

      <InstallBanner />
    </div>
  );
}
