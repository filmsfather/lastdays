/**
 * 환경 설정 유틸리티
 * 개발/스테이징/프로덕션 환경 구분
 */

export const ENV = {
  // 현재 환경
  CURRENT: process.env.NEXT_PUBLIC_ENV || process.env.NODE_ENV || 'development',
  
  // 환경 확인 함수
  isDevelopment: () => {
    const env = process.env.NEXT_PUBLIC_ENV || process.env.NODE_ENV
    return env === 'development' || (!process.env.NEXT_PUBLIC_ENV && process.env.NODE_ENV === 'development')
  },
  
  isStaging: () => process.env.NEXT_PUBLIC_ENV === 'staging',
  
  isProduction: () => process.env.NEXT_PUBLIC_ENV === 'production',
  
  // Supabase 설정
  supabase: {
    url: process.env.NEXT_PUBLIC_SUPABASE_URL!,
    anonKey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    serviceKey: process.env.SUPABASE_SERVICE_ROLE_KEY!,
  }
}

// 환경별 로그 출력
if (typeof window === 'undefined') {
  console.log(`🚀 Environment: ${ENV.CURRENT}`)
  console.log(`📍 Supabase URL: ${ENV.supabase.url}`)
}