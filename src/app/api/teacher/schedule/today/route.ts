import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { cookies } from 'next/headers'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

async function getCurrentUser() {
  try {
    const cookieStore = await cookies()
    const authCookie = cookieStore.get('auth')
    
    if (!authCookie) {
      return null
    }

    const { data: user, error } = await supabase
      .from('users')
      .select('id, name, class_name, role')
      .eq('id', parseInt(authCookie.value))
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

    // 오늘 날짜 (KST 기준)
    const today = new Date()
    today.setHours(today.getHours() + 9) // UTC to KST
    const todayString = today.toISOString().split('T')[0]

    // 교사의 당일 슬롯 조회
    const { data: slots, error: slotsError } = await supabase
      .from('reservation_slots')
      .select(`
        id,
        time_slot,
        session_period,
        max_capacity,
        reservations (
          id,
          status,
          problem_selected,
          created_at,
          student:users!reservations_student_id_fkey (
            id,
            name,
            class_name
          ),
          sessions (
            id,
            status
          )
        )
      `)
      .eq('date', todayString)
      .eq('teacher_id', user.id)
      .order('time_slot', { ascending: true })

    if (slotsError) {
      console.error('슬롯 조회 실패:', slotsError)
      return NextResponse.json({
        success: false,
        error: '스케줄을 불러오는데 실패했습니다.'
      }, { status: 500 })
    }

    // 슬롯 데이터 처리
    const processedSlots = slots.map(slot => {
      // 활성 예약만 필터링 (cancelled 제외)
      const activeReservations = slot.reservations?.filter(
        (reservation: any) => reservation.status === 'active'
      ) || []

      // 예약 시간순으로 정렬
      activeReservations.sort((a: any, b: any) => {
        return new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
      })

      return {
        id: slot.id,
        time_slot: slot.time_slot,
        session_period: slot.session_period,
        max_capacity: slot.max_capacity,
        student_count: activeReservations.length,
        reservations: activeReservations.map((reservation: any) => ({
          id: reservation.id,
          student: reservation.student,
          problem_selected: reservation.problem_selected,
          status: reservation.status,
          session: reservation.sessions?.[0] || null
        }))
      }
    })

    return NextResponse.json({
      success: true,
      slots: processedSlots,
      date: todayString,
      teacher: {
        id: user.id,
        name: user.name,
        class_name: user.class_name
      }
    })

  } catch (error) {
    console.error('당일 스케줄 조회 API 에러:', error)
    return NextResponse.json({
      success: false,
      error: '서버 오류가 발생했습니다.'
    }, { status: 500 })
  }
}