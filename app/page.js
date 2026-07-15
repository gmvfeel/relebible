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

  // 오늘의 기록(묵상·기도 노트)
  const [note, setNote] = useState('');            // 입력창 내용
  const [savedNote, setSavedNote] = useState('');  // 저장된 내용
  const [noteSaving, setNoteSaving] = useState(false);
  const [noteSavedMsg, setNoteSavedMsg] = useState(false);

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

  // 보고 있는 날짜(오늘 + viewOffset) YYYY-MM-DD
  const getViewDateString = () => {
    const kst = new Date(Date.now() + 9 * 60 * 60 * 1000);
    kst.setUTCDate(kst.getUTCDate() + viewOffset);
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
    setTodayDate(`${kst.getUTCFullYear()}년 ${kst.getUTCMonth() + 1}월 ${kst.getUTCDate()}일`);
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
    await loadNote();
    setLoading(false);
  };

  // 어제/내일 버튼으로 오프셋이 바뀌면 본문 다시 불러오기
  useEffect(() => {
    if (plan) {
      loadTodayVerses(plan, viewOffset);
    }
    if (user) {
      loadNote();
    }
  }, [viewOffset]);

  // 보고 있는 날짜의 기록 불러오기
  const loadNote = async () => {
    setNoteSavedMsg(false);
    const { data } = await supabase
      .from('rb_reading_notes')
      .select('content')
      .eq('user_id', user.id)
      .eq('note_date', getViewDateString())
      .maybeSingle();
    const saved = data?.content ?? '';
    setNote(saved);
    setSavedNote(saved);
  };

  // 기록 저장 (있으면 수정, 없으면 새로)
  const handleSaveNote = async () => {
    if (!user || note.trim() === '') return;
    setNoteSaving(true);

    const { error } = await supabase
      .from('rb_reading_notes')
      .upsert(
        {
          user_id: user.id,
          note_date: getViewDateString(),
          reference: refLabel,
          content: note.trim(),
          updated_at: new Date().toISOString(),
        },
        { onConflict: 'user_id,note_date' }
      );

    setNoteSaving(false);
    if (!error) {
      setSavedNote(note.trim());
      setNoteSavedMsg(true);
      setTimeout(() => setNoteSavedMsg(false), 2500);
    } else {
      alert('기록 저장 중 문제가 생겼어요. 잠시 후 다시 시도해 주세요.');
    }
  };

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
      {/* 상단 바 */}
      <div className="topbar">
        <span className="logo">
          <span className="logo-mark">RELEBIBLE</span>
          <span className="logo-ko">리리바이블</span>
        </span>
        <div className="topbar-right">
          {user ? (
            <>
              <button className="top-btn" onClick={() => router.push('/plan')}>
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20" />
                  <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z" />
                </svg>
                <span>읽기 계획</span>
              </button>
              <button className="top-btn" onClick={handleLogout}>
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
                  <polyline points="16 17 21 12 16 7" />
                  <line x1="21" y1="12" x2="9" y2="12" />
                </svg>
                <span>로그아웃</span>
              </button>
            </>
          ) : (
            <button className="top-btn" onClick={() => router.push('/login')}>
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
                <path d="M15 3h4a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-4" />
                <polyline points="10 17 15 12 10 7" />
                <line x1="15" y1="12" x2="3" y2="12" />
              </svg>
              <span>로그인</span>
            </button>
          )}
          <button className="top-icon-btn" onClick={toggleTheme} aria-label="테마 전환">
            {theme === 'dark' ? (
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="12" r="4" />
                <path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M6.3 17.7l-1.4 1.4M19.1 4.9l-1.4 1.4" />
              </svg>
            ) : (
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
                <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
              </svg>
            )}
          </button>
        </div>
      </div>

      {/* 진도 메타 */}
      <div className="meta">
        <div className="meta-date">{todayDate}</div>
        {user ? (
          <div className="meta-streak">
            성경읽기 <b>{totalDays}</b><span>일째</span>
          </div>
        ) : (
          <div className="meta-guide">로그인하면 나만의 읽기를 시작할 수 있어요</div>
        )}
      </div>

      {/* 상태별 화면 */}
      {loading ? (
        <div className="empty-state"><p className="empty-text">불러오는 중...</p></div>
      ) : !user ? (
        <div className="empty-state">
          <p className="empty-text">로그인하면 나만의 성경 읽기를 시작할 수 있어요.</p>
          <button className="empty-btn" onClick={() => router.push('/login')}>로그인 / 회원가입</button>
        </div>
      ) : !plan ? (
        <div className="empty-state">
          <p className="empty-text">{'아직 읽기 계획이 없어요.\n어떤 말씀을, 하루에 얼마씩 읽을지 정해보세요.'}</p>
          <button className="empty-btn" onClick={() => router.push('/plan')}>읽기 계획 정하기</button>
        </div>
      ) : verses.length === 0 ? (
        <div className="empty-state">
          <p className="empty-text">
            {viewOffset > 0
              ? '이 날의 분량이 아직 없어요.\n계획한 구간을 다 읽으면 새 계획을 정할 수 있어요.'
              : '계획하신 분량을 모두 읽으셨어요! 🎉\n새로운 구간을 정해 계속 읽어보세요.'}
          </p>
          {viewOffset !== 0 ? (
            <button className="empty-btn" onClick={() => setViewOffset(0)}>오늘로 돌아가기</button>
          ) : (
            <button className="empty-btn" onClick={() => router.push('/plan')}>새 계획 정하기</button>
          )}
        </div>
      ) : (
        <>
          <div className="reading-card">
            <div className="reading-cardhead">
              <span className="ref-inline">{refLabel}</span>
              <span className="amount-inline">오늘 분량 · {verses.length}절</span>
            </div>
            <div className="reading">
              <div className="verse-cols">
                <div className="verse-col">
                  <div className="verse-col-tag">개역한글</div>
                  <div className="passage-ko">
                    {verses.map((v) => (
                      <span key={`ko-${v.book_order}-${v.chapter}-${v.verse}`} className="v">
                        <span className="vn">{v.verse}</span>{v.text_ko}
                      </span>
                    ))}
                  </div>
                </div>
                <div className="verse-col">
                  <div className="verse-col-tag">KJV</div>
                  <div className="passage-en">
                    {verses.map((v) => (
                      <span key={`en-${v.book_order}-${v.chapter}-${v.verse}`} className="v">
                        <span className="vn">{v.verse}</span>{v.text_en}
                      </span>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* 오늘의 기록 (묵상·기도 노트) */}
          <div className="note-box">
            <div className="note-head">
              <span className="note-title">
                {viewOffset === 0 ? '오늘의 기록' : '이 날의 기록'}
              </span>
              <span className="note-desc">말씀을 읽고 떠오른 묵상이나 기도를 남겨보세요</span>
            </div>
            <textarea
              className="note-field"
              placeholder="오늘 마음에 와닿은 말씀, 기도 제목을 자유롭게 적어보세요."
              value={note}
              onChange={(e) => setNote(e.target.value)}
              rows={5}
            />
            <div className="note-foot">
              {noteSavedMsg && <span className="note-saved">저장되었어요 ✓</span>}
              <button
                className="note-save-btn"
                onClick={handleSaveNote}
                disabled={noteSaving || note.trim() === '' || note.trim() === savedNote}
              >
                {noteSaving ? '저장 중...' : savedNote ? '기록 수정' : '기록 저장'}
              </button>
            </div>
          </div>

          {/* 하단 */}
          <div className="footer">
            {viewOffset === 0 ? (
              completedToday ? (
                <div className="read-done">
                  <button className="cta done" disabled>오늘 읽기 완료 ✓</button>
                  <p className="encourage">오늘도 말씀과 함께하셨네요.</p>
                </div>
              ) : (
                <button className="cta" onClick={handleComplete} disabled={saving}>
                  {saving ? '저장 중...' : '오늘 읽기 완료'}
                </button>
              )
            ) : (
              <button className="cta done" onClick={() => setViewOffset(0)}>오늘로 돌아가기</button>
            )}

            <div className="day-nav">
              <button className="day-nav-btn" onClick={() => setViewOffset(viewOffset - 1)} disabled={dayNumber <= 1}>← 어제</button>
              <span className="day-nav-label">{viewOffset === 0 ? '오늘' : `${dayNumber}일째`}</span>
              <button className="day-nav-btn" onClick={() => setViewOffset(viewOffset + 1)}>내일 →</button>
            </div>
          </div>
        </>
      )}

      <InstallBanner />
    </div>
  );
}
