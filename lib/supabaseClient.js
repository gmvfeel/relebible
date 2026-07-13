import { createBrowserClient } from '@supabase/ssr';

// 수파베이스 연결 (브라우저용)
// 실제 주소와 키는 환경변수에 넣어두고 여기서 꺼내 씁니다.
export function createClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  );
}
