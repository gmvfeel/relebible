import './globals.css';

export const metadata = {
  title: '리리바이블 · 오늘의 말씀',
  description: '매일 조금씩, 쉽게 이해하며 다시 읽는 성경 — 리리바이블',
};

export default function RootLayout({ children }) {
  return (
    <html lang="ko" data-theme="dark">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          href="https://fonts.googleapis.com/css2?family=Nanum+Myeongjo:wght@400;700;800&family=Noto+Serif+KR:wght@400;600;900&family=Noto+Sans+KR:wght@400;500;700&family=EB+Garamond:ital,wght@0,400;0,500;1,400&family=Cormorant+Garamond:wght@400;600&family=Inter:wght@400;500;600&display=swap"
          rel="stylesheet"
        />
      </head>
      <body>{children}</body>
    </html>
  );
}
