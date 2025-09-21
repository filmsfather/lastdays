import { NextRequest, NextResponse } from 'next/server'
import { getCurrentUser } from '@/lib/auth'
import { supabase } from '@/lib/supabase'

// 작법 예약 처리 함수 (연속 2슬롯)
async function handleEssayReservation(firstSlotId: number, studentId: number, slotDate: Date) {
  try {
    // 1. 첫 번째 슬롯 정보 조회
    const { data: firstSlot, error: firstSlotError } = await supabase
      .from('reservation_slots')
      .select('*')
      .eq('id', firstSlotId)
      .single()

    if (firstSlotError || !firstSlot) {
      return NextResponse.json(
        { error: '첫 번째 슬롯을 찾을 수 없습니다.' },
        { status: 404 }
      )
    }

    // 2. 연속된 다음 슬롯 찾기 (같은 날, 같은 교사, 다음 시간)
    const currentTime = firstSlot.time_slot
    const nextTime = new Date(`2000-01-01T${currentTime}`)
    nextTime.setMinutes(nextTime.getMinutes() + 10) // 10분 간격
    const nextTimeString = nextTime.toTimeString().slice(0, 5)

    const { data: secondSlot, error: secondSlotError } = await supabase
      .from('reservation_slots')
      .select('*')
      .eq('date', firstSlot.date)
      .eq('teacher_id', firstSlot.teacher_id)
      .eq('time_slot', nextTimeString)
      .eq('is_available', true)
      .single()

    if (secondSlotError || !secondSlot) {
      return NextResponse.json(
        { error: '연속된 시간 슬롯이 없어 작법 예약이 불가능합니다.' },
        { status: 400 }
      )
    }

    // 3. 두 슬롯 모두 예약 가능한지 확인
    if (firstSlot.current_reservations >= firstSlot.max_capacity || 
        secondSlot.current_reservations >= secondSlot.max_capacity) {
      return NextResponse.json(
        { error: '선택한 시간대가 이미 예약되어 있습니다.' },
        { status: 400 }
      )
    }

    // 4. 예약 규칙 검증 (오전/오후 교차 제한, 동일 교사 제한)
    const { data: validationResult, error: validationError } = await supabase.rpc('validate_reservation_rules', {
      p_student_id: studentId,
      p_date: firstSlot.date,
      p_session_period: firstSlot.session_period,
      p_teacher_id: firstSlot.teacher_id
    })

    if (validationError) {
      console.error('Validation error:', validationError)
      return NextResponse.json(
        { error: '예약 규칙 검증 중 오류가 발생했습니다.' },
        { status: 500 }
      )
    }

    // 오전/오후 교차 예약 제한 체크
    if (!validationResult.can_reserve_cross_block) {
      return NextResponse.json(
        { error: '오전/오후 세션을 교차하여 예약할 수 없습니다.' },
        { status: 400 }
      )
    }

    // 동일 교사 제한 체크
    if (!validationResult.can_reserve_teacher) {
      return NextResponse.json(
        { error: '동일 교사에게는 하루 최대 2회까지만 예약할 수 있습니다.' },
        { status: 400 }
      )
    }

    // 5. 학생 티켓 확인 (2장 필요)
    const { data: studentData } = await supabase
      .from('accounts')
      .select('current_tickets')
      .eq('id', studentId)
      .single()

    if (!studentData || studentData.current_tickets < 2) {
      return NextResponse.json(
        { error: '작법 예약을 위해서는 이용권이 2장 필요합니다.' },
        { status: 400 }
      )
    }

    // 6. 트랜잭션으로 2슬롯 동시 예약
    const essayGroupId = crypto.randomUUID()
    
    const { data, error } = await supabase.rpc('create_essay_reservation', {
      p_first_slot_id: firstSlotId,
      p_second_slot_id: secondSlot.id,
      p_student_id: studentId,
      p_essay_group_id: essayGroupId
    })

    if (error) {
      console.error('Essay reservation creation failed:', error)
      return NextResponse.json(
        { error: '작법 예약 생성 중 오류가 발생했습니다.' },
        { status: 500 }
      )
    }

    return NextResponse.json({
      success: true,
      message: '작법 예약이 성공적으로 완료되었습니다.',
      data: {
        type: 'essay',
        essayGroupId,
        slots: [firstSlot, secondSlot],
        reservations: data
      }
    })

  } catch (error) {
    console.error('Essay reservation error:', error)
    return NextResponse.json(
      { error: '작법 예약 처리 중 오류가 발생했습니다.' },
      { status: 500 }
    )
  }
}

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
    const { slotId, studentId, type = 'normal' } = body

    console.log('Creating reservation:', { slotId, studentId, type, currentUser: currentUser.role })

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

    // 슬롯 정보 조회 및 요일별 예약 권한 체크
    const { data: slotData, error: slotError } = await supabase
      .from('reservation_slots') 
      .select('date')
      .eq('id', slotId)
      .single()

    if (slotError || !slotData) {
      return NextResponse.json(
        { error: '존재하지 않는 슬롯입니다.' },
        { status: 404 }
      )
    }

    // 예약 날짜의 요일 확인 (0=일요일, 6=토요일)
    const slotDate = new Date(slotData.date)
    const dayOfWeek = slotDate.getDay()

    // 해당 요일의 예약 권한 확인
    const { data: daySetting, error: dayError } = await supabase
      .from('reservation_day_settings')
      .select('is_enabled')
      .eq('day_of_week', dayOfWeek)
      .single()

    if (dayError || !daySetting?.is_enabled) {
      const dayNames = ['일요일', '월요일', '화요일', '수요일', '목요일', '금요일', '토요일']
      return NextResponse.json(
        { error: `${dayNames[dayOfWeek]}은 현재 예약이 제한되어 있습니다.` },
        { status: 403 }
      )
    }

    // 작법 예약 처리 (연속 2슬롯)
    if (type === 'essay') {
      return await handleEssayReservation(slotId, targetStudentId, slotDate)
    }

    // 일반 예약 처리
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