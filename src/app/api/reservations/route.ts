import { NextRequest, NextResponse } from 'next/server'
import { getCurrentUser } from '@/lib/auth'
import { supabase } from '@/lib/supabase'

// GET /api/reservations - 예약 조회
export async function GET(request: NextRequest) {
  try {
    const currentUser = await getCurrentUser()
    if (!currentUser) {
      return NextResponse.json(
        { error: '로그인이 필요합니다.' },
        { status: 401 }
      )
    }

    const { searchParams } = new URL(request.url)
    const studentId = searchParams.get('studentId')

    let query = supabase
      .from('reservations')
      .select(`
        *,
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
      .order('created_at', { ascending: false })

    // 학생은 자신의 예약만, 관리자는 모든 예약 또는 특정 학생 예약 조회
    if (currentUser.role === 'student') {
      query = query.eq('student_id', currentUser.id).eq('status', 'active')
    } else if (studentId) {
      query = query.eq('student_id', studentId)
    }

    const { data: reservations, error } = await query

    if (error) {
      console.error('Error fetching reservations:', error)
      return NextResponse.json(
        { error: '예약 조회 중 오류가 발생했습니다.' },
        { status: 500 }
      )
    }

    return NextResponse.json({
      success: true,
      reservations: reservations || []
    })

  } catch (error) {
    console.error('Get reservations error:', error)
    return NextResponse.json(
      { error: '서버 오류가 발생했습니다.' },
      { status: 500 }
    )
  }
}

// POST /api/reservations - 예약 생성 (즉시 티켓 차감)
export async function POST(request: NextRequest) {
  try {
    const currentUser = await getCurrentUser()
    if (!currentUser) {
      return NextResponse.json(
        { error: '로그인이 필요합니다.' },
        { status: 401 }
      )
    }

    const body = await request.json()
    const { slotId, studentId } = body

    console.log('Creating reservation:', { slotId, studentId, currentUser: currentUser.role })

    // 입력값 검증
    if (!slotId) {
      return NextResponse.json(
        { error: 'slotId가 필요합니다.' },
        { status: 400 }
      )
    }

    // 학생의 경우 자신만 예약 가능, 관리자는 다른 학생 대신 예약 가능
    let targetStudentId = currentUser.id
    if (currentUser.role === 'admin' && studentId) {
      targetStudentId = studentId
    } else if (currentUser.role !== 'student') {
      return NextResponse.json(
        { error: '학생만 예약할 수 있습니다.' },
        { status: 403 }
      )
    }

    // 트랜잭션 시작
    const { data, error } = await supabase.rpc('create_reservation_with_ticket_deduction', {
      p_slot_id: slotId,
      p_student_id: targetStudentId
    })

    if (error) {
      console.error('Reservation creation failed:', error)
      
      // 에러 메시지 분석하여 적절한 응답 반환
      if (error.message.includes('insufficient_tickets')) {
        return NextResponse.json(
          { error: '이용권이 부족합니다.' },
          { status: 400 }
        )
      } else if (error.message.includes('slot_full')) {
        return NextResponse.json(
          { error: '해당 슬롯이 가득 찼습니다.' },
          { status: 400 }
        )
      } else if (error.message.includes('daily_limit_exceeded')) {
        return NextResponse.json(
          { error: '일일 예약 한도(3회)를 초과했습니다.' },
          { status: 400 }
        )
      } else if (error.message.includes('cross_session_violation')) {
        return NextResponse.json(
          { error: '오전/오후 세션을 교차하여 예약할 수 없습니다.' },
          { status: 400 }
        )
      } else if (error.message.includes('teacher_limit_exceeded')) {
        return NextResponse.json(
          { error: '동일 교사에게는 하루 최대 2회까지만 예약할 수 있습니다.' },
          { status: 400 }
        )
      } else if (error.message.includes('slot_not_found')) {
        return NextResponse.json(
          { error: '존재하지 않는 슬롯입니다.' },
          { status: 404 }
        )
      } else if (error.message.includes('student_not_found')) {
        return NextResponse.json(
          { error: '존재하지 않는 학생입니다.' },
          { status: 404 }
        )
      } else {
        return NextResponse.json(
          { error: '예약 생성 중 오류가 발생했습니다.' },
          { status: 500 }
        )
      }
    }

    // 생성된 예약 정보 조회
    const { data: reservation, error: fetchError } = await supabase
      .from('reservations')
      .select(`
        *,
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
          class_name,
          current_tickets
        )
      `)
      .eq('id', data.reservation_id)
      .single()

    if (fetchError) {
      console.error('Error fetching created reservation:', fetchError)
      // 예약은 생성되었으므로 성공으로 처리
      return NextResponse.json({
        success: true,
        message: '예약이 생성되었습니다.',
        reservationId: data.reservation_id
      })
    }

    console.log('Reservation created successfully:', reservation)

    return NextResponse.json({
      success: true,
      message: '예약이 생성되고 이용권이 차감되었습니다.',
      reservation,
      ticketsDeducted: 1,
      remainingTickets: reservation.student.current_tickets
    })

  } catch (error) {
    console.error('Create reservation error:', error)
    return NextResponse.json(
      { error: '서버 오류가 발생했습니다.' },
      { status: 500 }
    )
  }
}