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
    const sessionCookie = cookieStore.get('session')
    const userCookie = cookieStore.get('user')
    
    if (!sessionCookie || !userCookie) {
      return null
    }

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

interface RouteContext {
  params: Promise<{
    studentId: string
  }>
}

export async function GET(request: Request, context: RouteContext) {
  try {
    const user = await getCurrentUser()
    
    // 임시: 개발환경에서는 하드코딩된 교사 사용자 사용
    const currentUser = user || {
      id: 14,
      name: '김선생',
      class_name: '수학교사',
      role: 'teacher'
    }
    
    if (!currentUser || currentUser.role !== 'teacher') {
      return NextResponse.json({
        success: false,
        error: '교사만 접근 가능합니다.'
      }, { status: 401 })
    }

    const params = await context.params
    const studentId = parseInt(params.studentId)
    
    if (isNaN(studentId)) {
      return NextResponse.json({
        success: false,
        error: '유효하지 않은 학생 ID입니다.'
      }, { status: 400 })
    }

    // 학생 기본 정보 조회
    const { data: student, error: studentError } = await supabase
      .from('accounts')
      .select('id, name, class_name, role')
      .eq('id', studentId)
      .eq('role', 'student')
      .single()

    if (studentError) {
      console.error('학생 정보 조회 실패:', studentError)
      return NextResponse.json({
        success: false,
        error: '학생 정보를 찾을 수 없습니다.'
      }, { status: 404 })
    }

    // 이용권 정보 조회 - accounts 테이블에서 current_tickets 사용
    const { data: ticketData, error: ticketError } = await supabase
      .from('accounts')
      .select('current_tickets')
      .eq('id', studentId)
      .single()

    if (ticketError && ticketError.code !== 'PGRST116') {
      console.error('이용권 조회 실패:', ticketError)
    }

    const remainingTickets = ticketData?.current_tickets || 0

    // 배지 시스템 제거됨

    // 피드백 히스토리 조회 (최근 50건)
    const { data: sessions, error: sessionsError } = await supabase
      .from('sessions')
      .select(`
        id,
        score,
        feedback,
        reflection,
        status,
        created_at,
        reservation:reservations (
          id,
          slot:reservation_slots (
            id,
            date,
            time_slot,
            session_period
          )
        ),
        problem:problems (
          id,
          title,
          subject_area,
          difficulty_level
        ),
        checklist_items (
          id,
          completed
        )
      `)
      .eq('student_id', studentId)
      .order('created_at', { ascending: false })
      .limit(50)

    if (sessionsError) {
      console.error('세션 조회 실패:', sessionsError)
      return NextResponse.json({
        success: false,
        error: '피드백 히스토리를 불러오는데 실패했습니다.'
      }, { status: 500 })
    }

    // 피드백 히스토리 데이터 가공
    const feedbackHistory = sessions.map(session => {
      const checklistTotal = session.checklist_items?.length || 0
      const checklistCompleted = session.checklist_items?.filter((item: any) => item.completed).length || 0

      // reservation과 problem이 배열로 반환되는 경우 처리
      const reservation = Array.isArray(session.reservation) ? session.reservation[0] : session.reservation
      const slot = Array.isArray(reservation?.slot) ? reservation.slot[0] : reservation?.slot
      const problem = Array.isArray(session.problem) ? session.problem[0] : session.problem

      return {
        session_id: session.id,
        date: slot?.date || '',
        timeSlot: slot?.time_slot || '10:00:00',
        sessionPeriod: slot?.session_period || 'AM',
        problem_title: problem?.title || '문제 정보 없음',
        problem_subject_area: problem?.subject_area || '',
        problem_difficulty_level: problem?.difficulty_level || 1,
        score: session.score,
        feedback: session.feedback,
        reflection: session.reflection,
        checklist_completed: checklistCompleted,
        checklist_total: checklistTotal,
        session_status: session.status,
        created_at: session.created_at
      }
    })

    // 총 세션 수 계산
    const { count: totalSessions, error: countError } = await supabase
      .from('sessions')
      .select('id', { count: 'exact', head: true })
      .eq('student_id', studentId)

    if (countError) {
      console.error('세션 수 조회 실패:', countError)
    }

    const studentDetail = {
      id: student.id,
      name: student.name,
      class_name: student.class_name,
      remaining_tickets: remainingTickets,
      total_sessions: totalSessions || 0,
      feedback_history: feedbackHistory
    }

    return NextResponse.json({
      success: true,
      student: studentDetail
    })

  } catch (error) {
    console.error('학생 상세 조회 API 에러:', error)
    return NextResponse.json({
      success: false,
      error: '서버 오류가 발생했습니다.'
    }, { status: 500 })
  }
}