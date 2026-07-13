'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '../../lib/supabaseClient';

export default function PlanPage() {
  const [theme, setTheme] = useState('dark');
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  // 선택 옵션 데이터
  const [books, setBooks] = useState([]);        // [{book_order, book_ko}]
  const [chapters, setChapters] = useState([]);  // [1,2,3...]
  const [verses, setVerses] = useState([]);      // [1,2,3...]

  // 사용자 선택값
  const [selectedBook, setSelectedBook] = useState(null); // {book_order, book_ko}
  const [selectedChapter, setSelectedChapter] = useState('');
  const [selectedVerse, setSelectedVerse] = useState('');
  const [versesPerDay, setVersesPerDay] = useState(5);

  const [saving, setSaving] = useState(false);

  const router = useRouter();
  const supabase = createClient();

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
  }, [theme]);

  // 로그인 확인
  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      if (!data?.user) {
        router.push('/login');
        return;
      }
      setUser(data.user);
    });
  }, []);

  // 책 목록 불러오기 (66권)
  useEffect(() => {
    loadBooks();
  }, []);

  const loadBooks = async () => {
    setLoading(true);
    // 각 책의 대표 행 하나씩 (book_order, book_ko)
    const { data, error } = await supabase
      .from('rb_bible_verses')
      .select('book_order, book_ko')
      .eq('chapter', 1)
      .eq('verse', 1)
      .order('book_order', { ascending: true });
    if (!error && data) {
      setBooks(data);
    }
    setLoading(false);
  };

  // 책을 고르면 → 그 책의 장 목록 불러오기
  const handleSelectBook = async (bookOrderStr) => {
    const bookOrder = Number(bookOrderStr);
    const book = books.find((b) => b.book_order === bookOrder);
    setSelectedBook(book || null);
    setSelectedChapter('');
    setSelectedVerse('');
    setChapters([]);
    setVerses([]);
    if (!book) return;

    // 그 책의 최대 장 수 구하기
    const { data } = await supabase
      .from('rb_bible_verses')
      .select('chapter')
      .eq('book_order', bookOrder)
      .order('chapter', { ascending: false })
      .limit(1);
    const maxChapter = data?.[0]?.chapter ?? 1;
    setChapters(Array.from({ length: maxChapter }, (_, i) => i + 1));
  };

  // 장을 고르면 → 그 장의 절 목록 불러오기
  const handleSelectChapter = async (chapterStr) => {
    const chapter = Number(chapterStr);
    setSelectedChapter(chapter);
    setSelectedVerse('');
    setVerses([]);
    if (!selectedBook || !chapter) return;

    const { data } = await supabase
      .from('rb_bible_verses')
      .select('verse')
      .eq('book_order', selectedBook.book_order)
      .eq('chapter', chapter)
      .order('verse', { ascending: false })
      .limit(1);
    const maxVerse = data?.[0]?.verse ?? 1;
    setVerses(Array.from({ length: maxVerse }, (_, i) => i + 1));
  };

  // 한국 시간 기준 오늘 날짜
  const getTodayString = () => {
    const kst = new Date(Date.now() + 9 * 60 * 60 * 1000);
    const y = kst.getUTCFullYear();
    const m = String(kst.getUTCMonth() + 1).padStart(2, '0');
    const d = String(kst.getUTCDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
  };

  const canSave =
    selectedBook && selectedChapter && selectedVerse && versesPerDay >= 1;

  const handleSave = async () => {
    if (!canSave || !user) return;
    setSaving(true);

    // 기존 활성 계획들은 비활성화 (새 계획으로 교체)
    await supabase
      .from('rb_reading_plan')
      .update({ is_active: false })
      .eq('user_id', user.id)
      .eq('is_active', true);

    const { error } = await supabase.from('rb_reading_plan').insert({
      user_id: user.id,
      book_order: selectedBook.book_order,
      book_ko: selectedBook.book_ko,
      start_chapter: Number(selectedChapter),
      start_verse: Number(selectedVerse),
      verses_per_day: Number(versesPerDay),
      start_date: getTodayString(),
      is_active: true,
    });

    setSaving(false);

    if (!error) {
      router.push('/');
    } else {
      alert('계획을 저장하는 중 문제가 생겼어요. 잠시 후 다시 시도해 주세요.');
    }
  };

  return (
    <div className="container">
      <div className="topbar">
        <span className="logo" onClick={() => router.push('/')} style={{ cursor: 'pointer' }}>
          R<span className="sun-e">e</span>leBible
        </span>
      </div>

      <div className="plan-wrap">
        <h1 className="plan-title">읽기 계획 정하기</h1>
        <p className="plan-sub">어디서부터, 하루에 얼마씩 읽을지 정해보세요.</p>

        {loading ? (
          <p className="plan-loading">불러오는 중...</p>
        ) : (
          <div className="plan-form">
            {/* 책 선택 */}
            <div className="plan-field">
              <label className="plan-label">책</label>
              <select
                className="plan-select"
                value={selectedBook?.book_order ?? ''}
                onChange={(e) => handleSelectBook(e.target.value)}
              >
                <option value="">책을 선택하세요</option>
                {books.map((b) => (
                  <option key={b.book_order} value={b.book_order}>
                    {b.book_ko}
                  </option>
                ))}
              </select>
            </div>

            {/* 장 선택 */}
            <div className="plan-field">
              <label className="plan-label">장 (편)</label>
              <select
                className="plan-select"
                value={selectedChapter}
                onChange={(e) => handleSelectChapter(e.target.value)}
                disabled={!selectedBook}
              >
                <option value="">
                  {selectedBook ? '장을 선택하세요' : '먼저 책을 고르세요'}
                </option>
                {chapters.map((c) => (
                  <option key={c} value={c}>{c}장</option>
                ))}
              </select>
            </div>

            {/* 절 선택 */}
            <div className="plan-field">
              <label className="plan-label">시작 절</label>
              <select
                className="plan-select"
                value={selectedVerse}
                onChange={(e) => setSelectedVerse(Number(e.target.value))}
                disabled={!selectedChapter}
              >
                <option value="">
                  {selectedChapter ? '절을 선택하세요' : '먼저 장을 고르세요'}
                </option>
                {verses.map((v) => (
                  <option key={v} value={v}>{v}절</option>
                ))}
              </select>
            </div>

            {/* 하루 분량 */}
            <div className="plan-field">
              <label className="plan-label">하루에 읽을 분량</label>
              <div className="plan-perday">
                <input
                  type="number"
                  className="plan-number"
                  min="1"
                  max="50"
                  value={versesPerDay}
                  onChange={(e) => setVersesPerDay(e.target.value)}
                />
                <span className="plan-unit">절씩</span>
              </div>
            </div>

            {/* 미리보기 */}
            {canSave && (
              <div className="plan-preview">
                오늘부터 <b>{selectedBook.book_ko} {selectedChapter}:{selectedVerse}</b>부터
                하루 <b>{versesPerDay}절씩</b> 읽어요.
              </div>
            )}

            <button
              className="plan-save-btn"
              onClick={handleSave}
              disabled={!canSave || saving}
            >
              {saving ? '저장 중...' : '이 계획으로 시작하기'}
            </button>

            <button className="plan-cancel-btn" onClick={() => router.push('/')}>
              취소하고 돌아가기
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
