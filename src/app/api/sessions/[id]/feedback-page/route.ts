import { NextRequest, NextResponse } from 'next/server'
import { getCurrentUser } from '@/lib/auth'
import { supabase } from '@/lib/supabase'

// GET /api/sessions/[id]/feedback-page - 피드백 페이지 데이터 조회
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const currentUser = await getCurrentUser()
    if (!currentUser) {
      return NextResponse.json(
        { error: '로그인이 필요합니다.' },
        { status: 401 }
      )
    }

    const resolvedParams = await params
    const sessionId = parseInt(resolvedParams.id)
    if (isNaN(sessionId)) {
      return NextResponse.json(
        { error: '올바른 세션 ID가 아닙니다.' },
        { status: 400 }
      )
    }

    // 세션 기본 정보 및 관련 데이터 조회
    const { data: session, error: sessionError } = await supabase
      .from('sessions')
      .select(`
        *,
        reservation:reservation_id (
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
        ),
        problem:problem_id (
          id,
          title,
          content,
          difficulty_level,
          subject_area
        )
      `)
      .eq('id', sessionId)
      .single()

    if (sessionError || !session) {
      console.error('Error fetching session:', sessionError)
      return NextResponse.json(
        { error: '세션을 찾을 수 없습니다.' },
        { status: 404 }
      )
    }

    // 권한 확인: 학생 본인, 담당 교사, 또는 관리자만 조회 가능
    const isStudent = currentUser.role === 'student' && session.reservation.student_id === currentUser.id
    const isTeacher = currentUser.role === 'teacher' && session.reservation.slot.teacher.id === currentUser.id
    const isAdmin = currentUser.role === 'admin'

    if (!isStudent && !isTeacher && !isAdmin) {
      return NextResponse.json(
        { error: '해당 세션에 대한 권한이 없습니다.' },
        { status: 403 }
      )
    }

    // 문제 표시 권한 확인 (세션이 완료된 후에만 가능)
    const canShowProblem = session.status === 'completed'

    // 채점 정보 조회
    const { data: scores, error: scoresError } = await supabase
      .from('scores')
      .select(`
        *,
        scorer:scored_by (
          id,
          name,
          class_name
        )
      `)
      .eq('session_id', sessionId)
      .single()

    // 피드백 정보 조회
    const { data: feedbacks, error: feedbacksError } = await supabase
      .from('feedbacks')
      .select(`
        *,
        giver:given_by (
          id,
          name,
          class_name
        )
      `)
      .eq('session_id', sessionId)

    // 체크리스트 항목 조회
    const { data: checklistItems, error: checklistError } = await supabase
      .from('checklist_items')
      .select(`
        *,
        checker:checked_by (
          id,
          name,
          class_name
        )
      `)
      .eq('session_id', sessionId)
      .order('created_at', { ascending: true })

    // 학생 복기 조회
    const { data: studentReflection, error: reflectionError } = await supabase
      .from('student_reflections')
      .select('*')
      .eq('session_id', sessionId)
      .single()

    // 문제 스냅샷 생성 (문제 표시 권한이 있는 경우에만)
    const problemSnapshot = canShowProblem ? {
      id: session.problem.id,
      title: session.problem.title,
      content: session.problem.content,
      difficulty_level: session.problem.difficulty_level,
      subject_area: session.problem.subject_area
    } : null

    // 응답 데이터 구성
    const responseData = {
      sessionId: session.id,
      status: session.status,
      startedAt: session.started_at,
      completedAt: session.completed_at,
      student: {
        id: session.reservation.student.id,
        name: session.reservation.student.name,
        className: session.reservation.student.class_name
      },
      teacher: {
        id: session.reservation.slot.teacher.id,
        name: session.reservation.slot.teacher.name,
        className: session.reservation.slot.teacher.class_name
      },
      slot: {
        date: session.reservation.slot.date,
        timeSlot: session.reservation.slot.time_slot,
        sessionPeriod: session.reservation.slot.session_period
      },
      problemSnapshot,
      scores: scoresError ? null : scores,
      teacherFeedback: feedbacksError ? [] : (feedbacks || []),
      checklistItems: checklistError ? [] : (checklistItems || []),
      studentReflection: reflectionError ? null : studentReflection,
      canShowProblem
    }

    return NextResponse.json({
      success: true,
      data: responseData
    })

  } catch (error) {
    console.error('Get feedback page error:', error)
    return NextResponse.json(
      { error: '서버 오류가 발생했습니다.' },
      { status: 500 }
    )
  }
}