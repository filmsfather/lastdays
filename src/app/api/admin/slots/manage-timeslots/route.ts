import { NextRequest, NextResponse } from 'next/server'
import { getCurrentUser } from '@/lib/auth'
import { supabase } from '@/lib/supabase'

// 타임슬롯 삭제 API
export async function DELETE(request: NextRequest) {
  try {
    const currentUser = await getCurrentUser()
    if (!currentUser || currentUser.role !== 'admin') {
      return NextResponse.json(
        { error: '관리자 권한이 필요합니다.' },
        { status: 403 }
      )
    }

    const { searchParams } = new URL(request.url)
    const date = searchParams.get('date')
    const timeSlot = searchParams.get('time_slot')
    const teacherId = searchParams.get('teacher_id')
    const force = searchParams.get('force') === 'true'

    console.log('DELETE request params:', { date, timeSlot, teacherId, force })

    if (!date || !timeSlot || !teacherId) {
      return NextResponse.json(
        { error: '날짜, 시간, 교사 ID가 필요합니다.' },
        { status: 400 }
      )
    }

    let result, error

    if (force) {
      // 관리자 강제 삭제 (예약 자동 취소)
      const { data: forceResult, error: forceError } = await supabase
        .rpc('admin_force_remove_time_slot', {
          p_date: date,
          p_time_slot: timeSlot,
          p_teacher_id: parseInt(teacherId),
          p_admin_id: currentUser.id
        })
      
      result = forceResult
      error = forceError
    } else {
      // 일반 삭제 (예약이 있으면 실패)
      const { data: normalResult, error: normalError } = await supabase
        .rpc('remove_time_slot', {
          p_date: date,
          p_time_slot: timeSlot,
          p_teacher_id: parseInt(teacherId)
        })
      
      result = normalResult
      error = normalError
    }

    if (error) {
      console.error('Error removing time slot:', error)
      
      if (error.message.includes('cannot_delete_slot_with_reservations')) {
        return NextResponse.json(
          { error: '예약이 있는 슬롯은 삭제할 수 없습니다. 강제 삭제를 원한다면 force=true 옵션을 사용하세요.' },
          { status: 400 }
        )
      }
      
      if (error.message.includes('admin_permission_required')) {
        return NextResponse.json(
          { error: '관리자 권한이 필요합니다.' },
          { status: 403 }
        )
      }
      
      if (error.message.includes('slot_not_found')) {
        return NextResponse.json(
          { error: '삭제할 슬롯을 찾을 수 없습니다.' },
          { status: 404 }
        )
      }
      
      return NextResponse.json(
        { error: '타임슬롯 삭제 중 오류가 발생했습니다.' },
        { status: 500 }
      )
    }

    if (!result) {
      return NextResponse.json(
        { error: '삭제할 슬롯을 찾을 수 없습니다.' },
        { status: 404 }
      )
    }

    if (force && result.success) {
      // 강제 삭제 결과 반환
      return NextResponse.json({
        success: true,
        message: result.message,
        cancelled_reservations: result.cancelled_reservations,
        affected_students: result.affected_students?.length || 0
      })
    } else {
      // 일반 삭제 결과 반환
      return NextResponse.json({
        success: true,
        message: '타임슬롯이 삭제되었습니다.'
      })
    }

  } catch (error) {
    console.error('Delete timeslot error:', error)
    return NextResponse.json(
      { error: '서버 오류가 발생했습니다.' },
      { status: 500 }
    )
  }
}

// 쉬는시간 설정/해제 API
export async function PATCH(request: NextRequest) {
  try {
    const currentUser = await getCurrentUser()
    if (!currentUser || currentUser.role !== 'admin') {
      return NextResponse.json(
        { error: '관리자 권한이 필요합니다.' },
        { status: 403 }
      )
    }

    const body = await request.json()
    const { date, timeSlot, teacherId, isBreak } = body

    if (!date || !timeSlot || !teacherId || typeof isBreak !== 'boolean') {
      return NextResponse.json(
        { error: '필수 파라미터가 누락되었습니다.' },
        { status: 400 }
      )
    }

    // PostgreSQL 함수 호출로 쉬는시간 설정
    const { data: result, error } = await supabase
      .rpc('set_break_time', {
        p_date: date,
        p_time_slot: timeSlot,
        p_teacher_id: teacherId,
        p_is_break: isBreak
      })

    if (error) {
      console.error('Error setting break time:', error)
      
      if (error.message.includes('cannot_set_break_time_with_reservations')) {
        return NextResponse.json(
          { error: '예약이 있는 슬롯은 쉬는시간으로 설정할 수 없습니다.' },
          { status: 400 }
        )
      }
      
      return NextResponse.json(
        { error: '쉬는시간 설정 중 오류가 발생했습니다.' },
        { status: 500 }
      )
    }

    if (!result) {
      return NextResponse.json(
        { error: '해당 슬롯을 찾을 수 없습니다.' },
        { status: 404 }
      )
    }

    return NextResponse.json({
      success: true,
      message: isBreak ? '쉬는시간으로 설정되었습니다.' : '예약 가능으로 변경되었습니다.',
      isBreak: isBreak
    })

  } catch (error) {
    console.error('Set break time error:', error)
    return NextResponse.json(
      { error: '서버 오류가 발생했습니다.' },
      { status: 500 }
    )
  }
}