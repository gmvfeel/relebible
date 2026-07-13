'use client';

import { useState, useEffect } from 'react';

export default function InstallBanner() {
  const [deferredPrompt, setDeferredPrompt] = useState(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    // 이미 설치된 상태(홈화면에서 실행 중)면 배너 안 보임
    const isStandalone =
      window.matchMedia('(display-mode: standalone)').matches ||
      window.navigator.standalone === true;
    if (isStandalone) return;

    // 이전에 닫은 적 있으면 하루 동안 안 보이게
    const dismissedAt = localStorage.getItem('rb_install_dismissed');
    if (dismissedAt && Date.now() - Number(dismissedAt) < 24 * 60 * 60 * 1000) {
      return;
    }

    // 브라우저가 "설치 가능" 신호를 보내면 배너 표시
    const handler = (e) => {
      e.preventDefault();
      setDeferredPrompt(e);
      setVisible(true);
    };
    window.addEventListener('beforeinstallprompt', handler);
    return () => window.removeEventListener('beforeinstallprompt', handler);
  }, []);

  const handleInstall = async () => {
    if (!deferredPrompt) return;
    deferredPrompt.prompt();
    await deferredPrompt.userChoice;
    setDeferredPrompt(null);
    setVisible(false);
  };

  const handleDismiss = () => {
    setVisible(false);
    localStorage.setItem('rb_install_dismissed', String(Date.now()));
  };

  if (!visible) return null;

  return (
    <div className="install-banner">
      <div className="install-icon">
        <img src="/icon-192.png" alt="ReleBible" width="36" height="36" />
      </div>
      <div className="install-text">
        홈 화면에 설치하면 앱처럼 바로 열 수 있어요.
      </div>
      <button className="install-btn" onClick={handleInstall}>설치</button>
      <button className="install-close" onClick={handleDismiss} aria-label="닫기">×</button>
    </div>
  );
}
