import { NextRequest, NextResponse } from 'next/server'
import { getCurrentUser } from '@/lib/auth'
import { supabase } from '@/lib/supabase'

// POST /api/reservations/[id]/select-problem - 당일 문제 선택 및 세션 생성
export async function POST(
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

    // 학생만 문제를 선택할 수 있음
    if (currentUser.role !== 'student') {
      return NextResponse.json(
        { error: '학생만 문제를 선택할 수 있습니다.' },
        { status: 403 }
      )
    }

    const resolvedParams = await params
    const reservationId = parseInt(resolvedParams.id)
    if (isNaN(reservationId)) {
      return NextResponse.json(
        { error: '올바른 예약 ID가 아닙니다.' },
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

    console.log('Selecting problem:', { reservationId, problemId, userId: currentUser.id })

    // 예약 정보 조회 및 검증
    const { data: reservation, error: reservationError } = await supabase
      .from('reservations')
      .select(`
        *,
        slot:slot_id (
          id,
          date,
          time_slot,
          session_period,
          teacher_id
        )
      `)
      .eq('id', reservationId)
      .eq('student_id', currentUser.id)
      .single()

    if (reservationError || !reservation) {
      return NextResponse.json(
        { error: '예약을 찾을 수 없습니다.' },
        { status: 404 }
      )
    }

    // 예약 상태 확인
    if (reservation.status !== 'active') {
      return NextResponse.json(
        { error: '활성 상태의 예약만 문제를 선택할 수 있습니다.' },
        { status: 400 }
      )
    }

    // 이미 문제가 선택되었는지 확인
    if (reservation.problem_selected) {
      return NextResponse.json(
        { error: '이미 문제가 선택된 예약입니다.' },
        { status: 400 }
      )
    }

    // 당일 예약인지 확인
    const reservationDate = new Date(reservation.slot.date)
    const currentDate = new Date()
    const currentDateString = currentDate.toISOString().split('T')[0]
    const reservationDateString = reservationDate.toISOString().split('T')[0]

    if (currentDateString !== reservationDateString) {
      return NextResponse.json(
        { error: '당일 예약에서만 문제를 선택할 수 있습니다.' },
        { status: 400 }
      )
    }

    // 문제 정보 조회
    const { data: problem, error: problemError } = await supabase
      .from('problems')
      .select('*')
      .eq('id', problemId)
      .eq('status', 'published')
      .single()

    if (problemError || !problem) {
      return NextResponse.json(
        { error: '문제를 찾을 수 없거나 아직 공개되지 않은 문제입니다.' },
        { status: 404 }
      )
    }

    // 이미 세션이 존재하는지 확인
    const { data: existingSession, error: sessionCheckError } = await supabase
      .from('sessions')
      .select('id')
      .eq('reservation_id', reservationId)
      .single()

    if (existingSession) {
      return NextResponse.json(
        { error: '이미 세션이 생성된 예약입니다.' },
        { status: 400 }
      )
    }

    // 트랜잭션: 세션 생성, 문제 스냅샷 저장, 예약 상태 업데이트, 학생 복기 초기 레코드 생성
    const { data: sessionResult, error: createError } = await supabase
      .rpc('create_session_with_problem', {
        p_reservation_id: reservationId,
        p_problem_id: problemId,
        p_problem_snapshot: {
          id: problem.id,
          title: problem.title,
          content: problem.content,
          difficulty_level: problem.difficulty_level,
          subject_area: problem.subject_area,
          created_by: problem.created_by,
          created_at: problem.created_at,
          updated_at: problem.updated_at
        }
      })

    if (createError) {
      console.error('Session creation failed:', createError)
      return NextResponse.json(
        { error: '세션 생성 중 오류가 발생했습니다.' },
        { status: 500 }
      )
    }

    // 생성된 세션 정보 조회
    const { data: newSession, error: fetchError } = await supabase
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
          difficulty_level,
          subject_area
        )
      `)
      .eq('id', sessionResult.session_id)
      .single()

    if (fetchError) {
      console.error('Error fetching created session:', fetchError)
      // 세션은 생성되었으므로 성공으로 처리
      return NextResponse.json({
        success: true,
        message: '문제가 선택되고 세션이 생성되었습니다.',
        sessionId: sessionResult.session_id
      })
    }

    console.log('Session created successfully:', newSession)

    return NextResponse.json({
      success: true,
      message: '문제가 선택되고 세션이 생성되었습니다.',
      session: newSession
    })

  } catch (error) {
    console.error('Select problem error:', error)
    return NextResponse.json(
      { error: '서버 오류가 발생했습니다.' },
      { status: 500 }
    )
  }
}