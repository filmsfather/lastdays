import { NextRequest, NextResponse } from 'next/server'
import { getCurrentUser } from '@/lib/auth'
import { supabase } from '@/lib/supabase'
import { getKoreanDateString } from '@/lib/dateUtils'

// PUT /api/sessions/[id]/change-problem - 선생님이 세션의 문제를 변경
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const currentUser = await getCurrentUser()
    if (!currentUser) {
      return NextResponse.json(
        { error: '인증이 필요합니다.' },
        { status: 401 }
      )
    }

    // 선생님만 문제를 변경할 수 있음
    if (currentUser.role !== 'teacher') {
      return NextResponse.json(
        { error: '선생님만 문제를 변경할 수 있습니다.' },
        { status: 403 }
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

    const body = await request.json()
    const { problemId } = body

    if (!problemId) {
      return NextResponse.json(
        { error: 'problemId가 필요합니다.' },
        { status: 400 }
      )
    }

    console.log('Changing problem:', { sessionId, problemId, teacherId: currentUser.id })

    // 세션 정보 조회 및 권한 검증
    const { data: session, error: sessionError } = await supabase
      .from('sessions')
      .select(`
        *,
        reservation:reservation_id (
          id,
          student:student_id (
            id,
            name,
            class_name
          ),
          slot:slot_id (
            id,
            date,
            time_slot,
            session_period,
            teacher_id
          )
        )
      `)
      .eq('id', sessionId)
      .single()

    if (sessionError || !session) {
      console.error('Session error:', sessionError)
      return NextResponse.json(
        { error: '세션을 찾을 수 없습니다.' },
        { status: 404 }
      )
    }

    // 해당 세션의 선생님인지 확인
    if (session.reservation.slot.teacher_id !== currentUser.id) {
      return NextResponse.json(
        { error: '해당 세션의 담당 선생님만 문제를 변경할 수 있습니다.' },
        { status: 403 }
      )
    }

    // 새로운 문제 정보 조회 및 유효성 검증
    const { data: newProblem, error: problemError } = await supabase
      .from('problems')
      .select('*')
      .eq('id', problemId)
      .eq('status', 'published')
      .single()

    console.log('New problem found:', newProblem ? { id: newProblem.id, title: newProblem.title, available_date: newProblem.available_date } : 'No problem found')
    console.log('Problem error:', problemError)

    if (problemError || !newProblem) {
      return NextResponse.json(
        { error: '문제를 찾을 수 없거나 아직 공개되지 않은 문제입니다.' },
        { status: 404 }
      )
    }

    // 세션 날짜와 문제 공개 날짜 확인 (선택적 - 엄격하게 하려면 활성화)
    const sessionDate = session.reservation.slot.date
    const today = getKoreanDateString()
    
    // 오늘이 아닌 세션의 경우 엄격한 날짜 확인
    if (sessionDate !== today && newProblem.available_date !== sessionDate) {
      return NextResponse.json(
        { error: '과거 또는 미래 세션의 경우 해당 날짜에 공개된 문제만 선택할 수 있습니다.' },
        { status: 400 }
      )
    }
    
    // 오늘 세션의 경우 경고만 하고 계속 진행
    if (sessionDate === today && newProblem.available_date !== sessionDate) {
      console.warn('Problem date mismatch for today session:', { sessionDate, problemDate: newProblem.available_date })
      // 당일 세션은 선생님이 의도적으로 다른 날짜 문제를 선택할 수 있음
    }

    // 세션의 문제 ID 업데이트
    const { data: updatedSession, error: updateError } = await supabase
      .from('sessions')
      .update({ 
        problem_id: problemId,
        updated_at: new Date().toISOString()
      })
      .eq('id', sessionId)
      .select()
      .single()

    if (updateError) {
      console.error('Session update failed:', updateError)
      return NextResponse.json(
        { error: `세션 문제 변경 중 오류가 발생했습니다: ${updateError.message}` },
        { status: 500 }
      )
    }

    console.log(`Session ${sessionId} problem changed from ${session.problem_id} to ${problemId} by teacher ${currentUser.id} (${currentUser.name})`)

    // 업데이트된 세션 정보를 다시 조회하여 반환
    const { data: sessionDetails, error: fetchError } = await supabase
      .from('sessions')
      .select(`
        *,
        reservation:reservation_id (
          id,
          student:student_id (
            id,
            name,
            class_name
          ),
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
          )
        ),
        problem:problem_id (
          id,
          title,
          content,
          limit_minutes,
          available_date,
          preview_lead_time,
          images
        )
      `)
      .eq('id', sessionId)
      .single()

    if (fetchError) {
      console.error('Error fetching updated session:', fetchError)
      // 업데이트는 성공했으므로 성공으로 처리
      return NextResponse.json({
        success: true,
        message: '문제가 성공적으로 변경되었습니다.',
        sessionId: sessionId
      })
    }

    console.log('Session problem changed successfully:', sessionDetails)

    return NextResponse.json({
      success: true,
      message: '문제가 성공적으로 변경되었습니다.',
      session: sessionDetails,
      sessionId: sessionDetails.id
    })

  } catch (error) {
    console.error('Change problem error:', error)
    console.error('Error stack:', error instanceof Error ? error.stack : 'No stack trace')
    return NextResponse.json(
      { error: `서버 오류가 발생했습니다: ${error instanceof Error ? error.message : 'Unknown error'}` },
      { status: 500 }
    )
  }
}