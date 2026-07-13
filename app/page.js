'use client';

import { useState, useEffect } from 'react';

export default function Home() {
  const [theme, setTheme] = useState('dark');
  const [todayDate, setTodayDate] = useState('');

  // 테마가 바뀌면 html 태그에 반영
  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
  }, [theme]);

  // 오늘 날짜 표시
  useEffect(() => {
    const months = ['JAN','FEB','MAR','APR','MAY','JUN','JUL','AUG','SEP','OCT','NOV','DEC'];
    const now = new Date();
    setTodayDate(months[now.getMonth()] + ' ' + now.getDate());
  }, []);

  const toggleTheme = () => {
    setTheme(theme === 'dark' ? 'light' : 'dark');
  };

  return (
    <div className="container">
      <div className="topbar">
        <span className="logo">relebible</span>
        <button className="theme-toggle" onClick={toggleTheme}>
          <span>{theme === 'dark' ? '☀️' : '🌙'}</span>
          <span>{theme === 'dark' ? '라이트 모드' : '다크 모드'}</span>
        </button>
      </div>

      <div className="date-header">
        <div>
          <div className="date">{todayDate}</div>
        </div>
        <div className="day-count">— 통독 1일째 —</div>
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
        <button className="nav-btn done">오늘 읽기 완료 ✓</button>
        <button className="nav-btn">내일 →</button>
      </div>
    </div>
  );
}
