import { NextRequest, NextResponse } from 'next/server'
import { getCurrentUser } from '@/lib/auth'
import { supabase } from '@/lib/supabase'

// GET /api/reservations/[id] - 특정 예약 조회
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
    const reservationId = parseInt(resolvedParams.id)
    if (isNaN(reservationId)) {
      return NextResponse.json(
        { error: '올바른 예약 ID가 아닙니다.' },
        { status: 400 }
      )
    }

    const { data: reservation, error } = await supabase
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
      .eq('id', reservationId)
      .single()

    if (error) {
      console.error('Error fetching reservation:', error)
      return NextResponse.json(
        { error: '예약을 찾을 수 없습니다.' },
        { status: 404 }
      )
    }

    // 권한 확인: 본인의 예약이거나 관리자인 경우만 조회 가능
    if (currentUser.role !== 'admin' && reservation.student_id !== currentUser.id) {
      return NextResponse.json(
        { error: '해당 예약에 대한 권한이 없습니다.' },
        { status: 403 }
      )
    }

    return NextResponse.json({
      success: true,
      reservation
    })

  } catch (error) {
    console.error('Get reservation error:', error)
    return NextResponse.json(
      { error: '서버 오류가 발생했습니다.' },
      { status: 500 }
    )
  }
}

// PATCH /api/reservations/[id] - 예약 수정 (전날까지만 가능)
export async function PATCH(
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
    const reservationId = parseInt(resolvedParams.id)
    if (isNaN(reservationId)) {
      return NextResponse.json(
        { error: '올바른 예약 ID가 아닙니다.' },
        { status: 400 }
      )
    }

    const body = await request.json()
    const { newSlotId } = body

    if (!newSlotId) {
      return NextResponse.json(
        { error: 'newSlotId가 필요합니다.' },
        { status: 400 }
      )
    }

    console.log('Updating reservation:', { reservationId, newSlotId })

    // 기존 예약 정보 조회
    const { data: existingReservation, error: fetchError } = await supabase
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
      .single()

    if (fetchError || !existingReservation) {
      return NextResponse.json(
        { error: '예약을 찾을 수 없습니다.' },
        { status: 404 }
      )
    }

    // 권한 확인: 본인의 예약이거나 관리자인 경우만 수정 가능
    if (currentUser.role !== 'admin' && existingReservation.student_id !== currentUser.id) {
      return NextResponse.json(
        { error: '해당 예약에 대한 권한이 없습니다.' },
        { status: 403 }
      )
    }

    // 예약 상태 확인
    if (existingReservation.status !== 'active') {
      return NextResponse.json(
        { error: '활성 상태의 예약만 수정할 수 있습니다.' },
        { status: 400 }
      )
    }

    // 전날까지만 수정 가능 확인
    const reservationDate = new Date(existingReservation.slot.date + 'T00:00:00+09:00')
    const currentDate = new Date(new Date().toLocaleString('en-US', { timeZone: 'Asia/Seoul' }))
    
    // 현재 시간이 예약 날짜의 전날 23:59를 지났는지 확인
    const dayBeforeReservation = new Date(reservationDate)
    dayBeforeReservation.setDate(dayBeforeReservation.getDate() - 1)
    dayBeforeReservation.setHours(23, 59, 59, 999)

    if (currentDate > dayBeforeReservation) {
      return NextResponse.json(
        { error: '예약 전날 23:59까지만 수정할 수 있습니다.' },
        { status: 400 }
      )
    }

    // 새 슬롯 정보 조회
    const { data: newSlot, error: slotError } = await supabase
      .from('reservation_slots')
      .select('*')
      .eq('id', newSlotId)
      .single()

    if (slotError || !newSlot) {
      return NextResponse.json(
        { error: '새로운 슬롯을 찾을 수 없습니다.' },
        { status: 404 }
      )
    }

    // 새 슬롯 용량 확인
    if (newSlot.current_reservations >= newSlot.max_capacity) {
      return NextResponse.json(
        { error: '새로운 슬롯이 가득 찼습니다.' },
        { status: 400 }
      )
    }

    // 예약 규칙 검증 (새로운 슬롯에 대해)
    const { data: validationResult, error: validationError } = await supabase
      .rpc('validate_reservation_rules', {
        p_student_id: existingReservation.student_id,
        p_date: newSlot.date,
        p_block: newSlot.block,
        p_teacher_id: newSlot.teacher_id
      })

    if (validationError) {
      console.error('Validation error:', validationError)
      return NextResponse.json(
        { error: '예약 규칙 검증 중 오류가 발생했습니다.' },
        { status: 500 }
      )
    }

    // 동일한 날짜인 경우, 현재 예약을 제외하고 검증해야 함
    const isSameDate = existingReservation.slot.date === newSlot.date
    
    if (isSameDate) {
      // 같은 날짜 내에서 슬롯만 변경하는 경우
      if (!validationResult.can_reserve_daily && validationResult.daily_reservations > 2) {
        // 현재 예약을 제외했을 때도 3회 이상이면 불가
        return NextResponse.json(
          { error: '일일 예약 한도(3회)를 초과했습니다.' },
          { status: 400 }
        )
      }

      // 오전/오후 교차 검증 (현재 예약 제외)
      if (!validationResult.can_reserve_cross_block) {
        const currentSlotIsAM = existingReservation.slot.session_period === 'AM'
        const newSlotIsAM = newSlot.session_period === 'AM'
        
        if (currentSlotIsAM !== newSlotIsAM) {
          // 다른 블록으로 변경하는 경우에만 검증
          return NextResponse.json(
            { error: '오전/오후 블록을 교차하여 예약할 수 없습니다.' },
            { status: 400 }
          )
        }
      }

      // 동일 교사 검증 (현재 예약 제외)
      if (!validationResult.can_reserve_teacher && validationResult.teacher_reservations > 1) {
        if (existingReservation.slot.teacher_id !== newSlot.teacher_id) {
          // 다른 교사로 변경하는 경우에만 검증
          return NextResponse.json(
            { error: '동일 교사에게는 하루 최대 2회까지만 예약할 수 있습니다.' },
            { status: 400 }
          )
        }
      }
    } else {
      // 다른 날짜로 변경하는 경우는 일반 검증 적용
      if (!validationResult.can_reserve_daily) {
        return NextResponse.json(
          { error: '일일 예약 한도(3회)를 초과했습니다.' },
          { status: 400 }
        )
      }

      if (!validationResult.can_reserve_cross_block) {
        return NextResponse.json(
          { error: '오전/오후 블록을 교차하여 예약할 수 없습니다.' },
          { status: 400 }
        )
      }

      if (!validationResult.can_reserve_teacher) {
        return NextResponse.json(
          { error: '동일 교사에게는 하루 최대 2회까지만 예약할 수 있습니다.' },
          { status: 400 }
        )
      }
    }

    // 예약 수정 트랜잭션 실행
    const { error: updateError } = await supabase.rpc('update_reservation', {
      p_reservation_id: reservationId,
      p_new_slot_id: newSlotId,
      p_old_slot_id: existingReservation.slot_id
    })

    if (updateError) {
      console.error('Reservation update failed:', updateError)
      return NextResponse.json(
        { error: '예약 수정 중 오류가 발생했습니다.' },
        { status: 500 }
      )
    }

    // 업데이트된 예약 정보 조회
    const { data: updatedReservation, error: fetchUpdatedError } = await supabase
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
      .eq('id', reservationId)
      .single()

    if (fetchUpdatedError) {
      console.error('Error fetching updated reservation:', fetchUpdatedError)
    }

    return NextResponse.json({
      success: true,
      message: '예약이 수정되었습니다.',
      reservation: updatedReservation
    })

  } catch (error) {
    console.error('Update reservation error:', error)
    return NextResponse.json(
      { error: '서버 오류가 발생했습니다.' },
      { status: 500 }
    )
  }
}

// DELETE /api/reservations/[id] - 예약 취소
export async function DELETE(
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
    const reservationId = parseInt(resolvedParams.id)
    if (isNaN(reservationId)) {
      return NextResponse.json(
        { error: '올바른 예약 ID가 아닙니다.' },
        { status: 400 }
      )
    }

    // 예약 취소 함수 호출
    const { data, error } = await supabase.rpc('cancel_reservation', {
      p_reservation_id: reservationId,
      p_user_id: currentUser.id
    })

    if (error) {
      console.error('Reservation cancellation failed:', error)
      
      if (error.message.includes('reservation_not_found')) {
        return NextResponse.json(
          { error: '예약을 찾을 수 없습니다.' },
          { status: 404 }
        )
      } else if (error.message.includes('reservation_not_active')) {
        return NextResponse.json(
          { error: '활성 상태의 예약만 취소할 수 있습니다.' },
          { status: 400 }
        )
      } else if (error.message.includes('insufficient_permission')) {
        return NextResponse.json(
          { error: '해당 예약에 대한 권한이 없습니다.' },
          { status: 403 }
        )
      } else {
        return NextResponse.json(
          { error: '예약 취소 중 오류가 발생했습니다.' },
          { status: 500 }
        )
      }
    }

    return NextResponse.json({
      success: true,
      message: '예약이 취소되고 이용권이 환불되었습니다.',
      ticketsRefunded: 1
    })

  } catch (error) {
    console.error('Cancel reservation error:', error)
    return NextResponse.json(
      { error: '서버 오류가 발생했습니다.' },
      { status: 500 }
    )
  }
}