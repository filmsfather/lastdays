import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { cookies } from 'next/headers'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

async function getCurrentUser() {
  try {
    console.log('Stats API getCurrentUser called')
    const cookieStore = await cookies()
    const sessionCookie = cookieStore.get('session')
    const userCookie = cookieStore.get('user')
    
    console.log('Stats API cookies:', {
      session: sessionCookie ? 'exists' : 'missing',
      user: userCookie ? 'exists' : 'missing'
    })
    
    if (!sessionCookie || !userCookie) {
      console.log('Stats API: No cookies found')
      return null
    }

    // 쿠키에서 사용자 정보 파싱
    const userInfo = JSON.parse(userCookie.value)
    
    const { data: user, error } = await supabase
      .from('accounts')
      .select('id, name, class_name, role')
      .eq('id', userInfo.id)
      .single()

    if (error) {
      console.error('사용자 조회 실패:', error)
      return null
    }

    return user
  } catch (error) {
    console.error('getCurrentUser 에러:', error)
    return null
  }
}

export async function GET() {
  try {
    const user = await getCurrentUser()
    
    if (!user || user.role !== 'teacher') {
      return NextResponse.json({
        success: false,
        error: '교사만 접근 가능합니다.'
      }, { status: 401 })
    }

    // 오늘 날짜 (KST)
    const today = new Date(new Date().toLocaleString('en-US', { timeZone: 'Asia/Seoul' }))
    const todayString = today.toISOString().split('T')[0]

    // 병렬로 모든 통계 조회
    const [
      totalProblemsResult,
      publicProblemsResult,
      privateProblemsResult,
      totalUsageResult,
      todaysSessionsResult,
      activeReservationsResult
    ] = await Promise.allSettled([
      // 전체 문제 수
      supabase
        .from('problems')
        .select('id', { count: 'exact', head: true })
        .eq('created_by', user.id),
      
      // 공개 문제 수
      supabase
        .from('problems')
        .select('id', { count: 'exact', head: true })
        .eq('created_by', user.id)
        .eq('status', 'published'),
      
      // 비공개 문제 수
      supabase
        .from('problems')
        .select('id', { count: 'exact', head: true })
        .eq('created_by', user.id)
        .in('status', ['draft', 'archived']),
      
      // 문제 사용 총 횟수
      supabase
        .from('sessions')
        .select(`
          problem:problems!inner (
            teacher_id
          )
        `, { count: 'exact', head: true })
        .eq('problems.created_by', user.id),
      
      // 오늘의 세션 수
      supabase
        .from('sessions')
        .select(`
          id,
          reservation:reservations!inner (
            slot:reservation_slots!inner (
              teacher_id,
              date
            )
          )
        `, { count: 'exact', head: true })
        .eq('reservations.reservation_slots.teacher_id', user.id)
        .eq('reservations.reservation_slots.date', todayString),
      
      // 활성 예약 수 (오늘 이후)
      supabase
        .from('reservations')
        .select(`
          id,
          slot:reservation_slots!inner (
            teacher_id,
            date
          )
        `, { count: 'exact', head: true })
        .eq('reservation_slots.teacher_id', user.id)
        .eq('status', 'active')
        .gte('reservation_slots.date', todayString)
    ])

    // 결과 처리
    const stats = {
      total_problems: totalProblemsResult.status === 'fulfilled' ? (totalProblemsResult.value.count || 0) : 0,
      public_problems: publicProblemsResult.status === 'fulfilled' ? (publicProblemsResult.value.count || 0) : 0,
      private_problems: privateProblemsResult.status === 'fulfilled' ? (privateProblemsResult.value.count || 0) : 0,
      total_usage: totalUsageResult.status === 'fulfilled' ? (totalUsageResult.value.count || 0) : 0,
      todays_sessions: todaysSessionsResult.status === 'fulfilled' ? (todaysSessionsResult.value.count || 0) : 0,
      active_reservations: activeReservationsResult.status === 'fulfilled' ? (activeReservationsResult.value.count || 0) : 0,
    }

    // 에러 로깅
    const results = [
      totalProblemsResult,
      publicProblemsResult,
      privateProblemsResult,
      totalUsageResult,
      todaysSessionsResult,
      activeReservationsResult
    ]
    
    results.forEach((result: any, index: number) => {
      if (result.status === 'rejected') {
        console.error(`통계 조회 ${index} 실패:`, result.reason)
      }
    })

    return NextResponse.json({
      success: true,
      stats,
      date: todayString
    })

  } catch (error) {
    console.error('대시보드 통계 조회 API 에러:', error)
    return NextResponse.json({
      success: false,
      error: '서버 오류가 발생했습니다.'
    }, { status: 500 })
  }
}