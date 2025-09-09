import { NextRequest, NextResponse } from 'next/server'
import { getCurrentUser } from '@/lib/auth'
import { supabase } from '@/lib/supabase'

// GET /api/sessions/[id]/feedback-data - 세션 피드백 데이터 조회
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const resolvedParams = await params
    const sessionId = parseInt(resolvedParams.id)
    
    if (isNaN(sessionId)) {
      return NextResponse.json(
        { error: '올바른 세션 ID가 아닙니다.' },
        { status: 400 }
      )
    }

    // 사용자 인증 확인
    const currentUser = await getCurrentUser()
    if (!currentUser) {
      return NextResponse.json(
        { error: '인증이 필요합니다.' },
        { status: 401 }
      )
    }

    // 1단계: 세션 기본 정보 조회
    const { data: session, error: sessionError } = await supabase
      .from('sessions')
      .select(`
        id,
        status,
        started_at,
        completed_at,
        created_at,
        updated_at,
        reservation_id,
        problem_id
      `)
      .eq('id', sessionId)
      .single()

    if (sessionError || !session) {
      console.error('Session fetch error:', sessionError)
      return NextResponse.json(
        { error: '세션을 찾을 수 없습니다.' },
        { status: 404 }
      )
    }

    // 2단계: 예약 정보 조회
    const { data: reservation, error: reservationError } = await supabase
      .from('reservations')
      .select(`
        id,
        student_id,
        slot:slot_id (
          id,
          date,
          time_slot,
          session_period,
          teacher:teacher_id (
            id,
            name,
            class_name
          )
        ),
        student:student_id (
          id,
          name,
          class_name
        )
      `)
      .eq('id', session.reservation_id)
      .single()

    if (reservationError || !reservation) {
      console.error('Reservation fetch error:', reservationError)
      return NextResponse.json(
        { error: '예약 정보를 찾을 수 없습니다.' },
        { status: 404 }
      )
    }

    // 3단계: 문제 정보 조회
    const { data: problem, error: problemError } = await supabase
      .from('problems')
      .select(`
        id,
        title,
        content,
        limit_minutes,
        available_date,
        images,
        preview_lead_time
      `)
      .eq('id', session.problem_id)
      .single()

    if (problemError || !problem) {
      console.error('Problem fetch error:', problemError)
      return NextResponse.json(
        { error: '문제 정보를 찾을 수 없습니다.' },
        { status: 404 }
      )
    }

    // 권한 확인: 학생 본인, 담당 교사, 또는 관리자만 조회 가능
    const isStudent = currentUser.role === 'student' && reservation.student_id === currentUser.id
    const isTeacher = currentUser.role === 'teacher' && (reservation.slot as any).teacher.id === currentUser.id
    const isAdmin = currentUser.role === 'admin'

    if (!isStudent && !isTeacher && !isAdmin) {
      return NextResponse.json(
        { error: '이 세션에 접근할 권한이 없습니다.' },
        { status: 403 }
      )
    }

    // 4단계: 같은 날짜/블록/교사의 예약들을 가져와서 큐 위치 계산
    const { data: queueData, error: queueError } = await supabase
      .from('reservations')
      .select(`
        id,
        created_at,
        slot:slot_id (
          date,
          session_period,
          teacher:teacher_id (id)
        )
      `)
      .eq('slot.date', (reservation.slot as any).date)
      .eq('slot.session_period', (reservation.slot as any).session_period)
      .eq('slot.teacher_id', (reservation.slot as any).teacher.id)
      .order('created_at', { ascending: true })

    if (queueError) {
      console.error('Queue calculation error:', queueError)
      return NextResponse.json(
        { error: '큐 정보 조회 실패' },
        { status: 500 }
      )
    }

    // 큐 위치 계산 (1부터 시작)
    const queuePosition = queueData.findIndex(r => r.id === reservation.id) + 1

    if (queuePosition === 0) {
      console.error('Reservation not found in queue')
      return NextResponse.json(
        { error: '큐에서 예약을 찾을 수 없습니다.' },
        { status: 500 }
      )
    }

    // 5단계: 스케줄링 계산
    // 예약 시작 시간 설정 - time_slot 필드를 직접 사용
    const slotDate = (reservation.slot as any).date
    const timeSlot = (reservation.slot as any).time_slot // 예: "17:00:00"
    const scheduledStartAt = new Date(slotDate + 'T' + timeSlot + '+09:00')
    
    // 디버그 로그
    console.log('=== 시간 계산 디버그 ===')
    console.log('slotDate:', slotDate)
    console.log('timeSlot:', timeSlot)
    console.log('scheduledStartAt:', scheduledStartAt.toISOString())
    
    // 한국 시간대 기준으로 현재 시간 가져오기
    const now = new Date(new Date().toLocaleString('en-US', { timeZone: 'Asia/Seoul' }))
    const previewLeadMinutes = problem.preview_lead_time || 10
    const previewStartTime = new Date(scheduledStartAt.getTime() - previewLeadMinutes * 60000)
    const waitingRoomTime = new Date(scheduledStartAt.getTime() - 5 * 60000) // 5분 전

    // 면접 시간은 고정 10분으로 설정
    const INTERVIEW_DURATION_MINUTES = 10
    const sessionEndTime = new Date(scheduledStartAt.getTime() + INTERVIEW_DURATION_MINUTES * 60000)
    
    // 추가 디버그 로그
    console.log('now:', now.toISOString())
    console.log('previewLeadMinutes:', previewLeadMinutes)
    console.log('previewStartTime:', previewStartTime.toISOString())
    console.log('sessionEndTime:', sessionEndTime.toISOString())
    
    // 시간 상태 판정
    let timeStatus: 'before_preview' | 'preview_open' | 'waiting_room' | 'interview_ready' | 'session_closed'
    let canShowProblem = false

    if (now >= sessionEndTime) {
      timeStatus = 'session_closed'
      canShowProblem = true // 세션 종료 후에도 문제는 볼 수 있음

      // 세션이 종료되었는데 아직 completed 상태가 아니라면 자동으로 업데이트
      if (session.status !== 'completed') {
        console.log('Auto-completing session:', sessionId)
        const { error: updateError } = await supabase
          .from('sessions')
          .update({
            status: 'completed',
            completed_at: sessionEndTime.toISOString()
          })
          .eq('id', sessionId)
        
        if (updateError) {
          console.error('Failed to auto-complete session:', updateError)
        } else {
          // 업데이트된 세션 정보를 반영
          session.status = 'completed'
          session.completed_at = sessionEndTime.toISOString()
        }
      }
    } else if (now < previewStartTime) {
      timeStatus = 'before_preview'
      canShowProblem = false
    } else if (now >= previewStartTime && now < waitingRoomTime) {
      timeStatus = 'preview_open'
      canShowProblem = true
    } else if (now >= waitingRoomTime && now < scheduledStartAt) {
      timeStatus = 'waiting_room'
      canShowProblem = false
    } else {
      timeStatus = 'interview_ready'
      canShowProblem = true
    }

    // 추가 데이터 조회
    const { data: scores } = await supabase
      .from('scores')
      .select('*')
      .eq('session_id', sessionId)
      .single()

    const { data: feedbacks } = await supabase
      .from('feedbacks')
      .select('*')
      .eq('session_id', sessionId)

    const { data: checklistItems } = await supabase
      .from('checklist_items')
      .select('*')
      .eq('session_id', sessionId)
      .order('created_at', { ascending: true })

    const { data: studentReflection } = await supabase
      .from('student_reflections')
      .select('*')
      .eq('session_id', sessionId)
      .single()

    // 문제 스냅샷 생성 (시간 기반 가시성 적용)
    const problemSnapshot = canShowProblem ? {
      id: problem.id,
      title: problem.title,
      content: problem.content,
      available_date: problem.available_date,
      images: problem.images || []
    } : null

    // 피드백 데이터 구성
    const feedbackData = {
      sessionId: session.id,
      status: session.status,
      startedAt: session.started_at,
      completedAt: session.completed_at,
      student: {
        id: (reservation.student as any).id,
        name: (reservation.student as any).name,
        className: (reservation.student as any).class_name
      },
      teacher: {
        id: (reservation.slot as any).teacher.id,
        name: (reservation.slot as any).teacher.name,
        className: (reservation.slot as any).teacher.class_name
      },
      slot: {
        date: (reservation.slot as any).date,
        session_period: (reservation.slot as any).session_period
      },
      scheduling: {
        queuePosition,
        scheduledStartAt: scheduledStartAt.toISOString(),
        previewLeadMinutes,
        canShowProblem,
        timeStatus
      },
      problemSnapshot,
      scores: scores ? {
        practical_skills: scores.practical_skills,
        major_knowledge: scores.major_knowledge,
        major_suitability: scores.major_suitability,
        attitude: scores.attitude
      } : null,
      teacherFeedback: feedbacks || [],
      checklistItems: checklistItems || [],
      studentReflection: studentReflection ? {
        text: studentReflection.reflection_text,
        updated_at: studentReflection.updated_at
      } : null
    }

    return NextResponse.json({
      success: true,
      data: feedbackData
    })

  } catch (error) {
    console.error('Feedback data API error:', error)
    return NextResponse.json(
      { error: '서버 오류가 발생했습니다.' },
      { status: 500 }
    )
  }
}