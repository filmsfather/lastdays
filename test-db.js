const { createClient } = require('@supabase/supabase-js');

// .env.local에서 환경변수 로드
require('dotenv').config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function testDatabase() {
  try {
    console.log('Supabase URL:', process.env.NEXT_PUBLIC_SUPABASE_URL);
    console.log('Service Role Key exists:', !!process.env.SUPABASE_SERVICE_ROLE_KEY);
    
    // 학생 데이터 조회 테스트
    const { data: students, error } = await supabase
      .from('accounts')
      .select('id, name, class_name, current_tickets, role')
      .eq('role', 'student');
    
    if (error) {
      console.error('데이터베이스 조회 오류:', error);
    } else {
      console.log('학생 데이터:', students);
      console.log('학생 수:', students?.length || 0);
    }
    
    // 전체 계정 조회 테스트
    const { data: allAccounts, error: allError } = await supabase
      .from('accounts')
      .select('id, name, class_name, role');
    
    if (allError) {
      console.error('전체 계정 조회 오류:', allError);
    } else {
      console.log('전체 계정:', allAccounts);
      console.log('전체 계정 수:', allAccounts?.length || 0);
    }
    
  } catch (err) {
    console.error('테스트 실행 오류:', err);
  }
}

testDatabase();