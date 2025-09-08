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
      console.error('Reservation error:', reservationError)
      return NextResponse.json(
        { error: '예약을 찾을 수 없습니다.' },
        { status: 404 }
      )
    }

    // 당일 예약인지 확인 (한국 시간 기준)
    const getKoreanDate = (date?: Date) => {
      const now = date || new Date()
      const koreanTime = new Intl.DateTimeFormat('fr-CA', { 
        timeZone: 'Asia/Seoul' 
      }).format(now)
      return koreanTime // YYYY-MM-DD 형태
    }

    const reservationDateString = reservation.slot.date
    const currentDateString = getKoreanDate()

    console.log('Date check (Korean timezone):', { currentDateString, reservationDateString })

    if (currentDateString !== reservationDateString) {
      return NextResponse.json(
        { error: '당일 예약에서만 문제를 선택할 수 있습니다.' },
        { status: 400 }
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

    // 문제 정보 조회
    const { data: problem, error: problemError } = await supabase
      .from('problems')
      .select('*')
      .eq('id', problemId)
      .eq('status', 'published')
      .single()

    console.log('Problem found:', problem ? { id: problem.id, title: problem.title, available_date: problem.available_date } : 'No problem found')
    console.log('Problem error:', problemError)

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

    // 세션 생성 (problem_snapshot 필드는 DB에 없으므로 제거)
    const sessionInsertData = {
      reservation_id: reservationId,
      problem_id: problemId,
      status: 'active'
    }

    console.log('Inserting session with data:', JSON.stringify(sessionInsertData, null, 2))

    const { data: newSession, error: sessionError } = await supabase
      .from('sessions')
      .insert(sessionInsertData)
      .select('id')
      .single()

    if (sessionError) {
      console.error('Session creation failed:', sessionError)
      console.error('Session data attempted:', {
        reservation_id: reservationId,
        problem_id: problemId,
        status: 'active'
      })
      return NextResponse.json(
        { error: `세션 생성 중 오류가 발생했습니다: ${sessionError.message}` },
        { status: 500 }
      )
    }

    console.log('Session created successfully with ID:', newSession.id)

    // 예약 상태를 problem_selected = true로 업데이트
    const { error: reservationUpdateError } = await supabase
      .from('reservations')
      .update({ problem_selected: true })
      .eq('id', reservationId)

    if (reservationUpdateError) {
      console.error('Reservation update failed:', reservationUpdateError)
      // 세션은 생성되었으므로 계속 진행
    }

    // 초기 학생 복기 레코드 생성 (선택적)
    try {
      const { error: reflectionError } = await supabase
        .from('student_reflections')
        .insert({
          session_id: newSession.id,
          student_id: currentUser.id,
          text: ''
        })

      if (reflectionError) {
        console.error('Initial reflection creation failed:', reflectionError)
        // 복기는 나중에 추가할 수 있으므로 계속 진행
      }
    } catch (reflectionCreateError) {
      console.error('Reflection creation exception:', reflectionCreateError)
      // 복기 생성 실패해도 세션은 성공으로 처리
    }

    // 생성된 세션 정보 조회
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
          limit_minutes,
          available_date,
          preview_lead_time
        )
      `)
      .eq('id', newSession.id)
      .single()

    if (fetchError) {
      console.error('Error fetching created session:', fetchError)
      // 세션은 생성되었으므로 성공으로 처리
      return NextResponse.json({
        success: true,
        message: '문제가 선택되고 세션이 생성되었습니다.',
        sessionId: newSession.id
      })
    }

    console.log('Session created successfully:', sessionDetails)

    return NextResponse.json({
      success: true,
      message: '문제가 선택되고 세션이 생성되었습니다.',
      session: sessionDetails,
      sessionId: sessionDetails.id
    })

  } catch (error) {
    console.error('Select problem error:', error)
    console.error('Error stack:', error instanceof Error ? error.stack : 'No stack trace')
    return NextResponse.json(
      { error: `서버 오류가 발생했습니다: ${error instanceof Error ? error.message : 'Unknown error'}` },
      { status: 500 }
    )
  }
}