import { NextRequest, NextResponse } from 'next/server'
import { withTeacherOrAdmin } from '@/lib/middleware'
import { supabase } from '@/lib/supabase'

// 쉬는시간 설정/해제 API (선생님/관리자용)
export const PATCH = withTeacherOrAdmin(async (request) => {
  try {
    const body = await request.json()
    const { date, timeSlot, teacherId, isBreak } = body

    if (!date || !timeSlot || !teacherId || typeof isBreak !== 'boolean') {
      return NextResponse.json(
        { error: '필수 파라미터가 누락되었습니다.' },
        { status: 400 }
      )
    }

    // 선생님은 자신의 스케줄만 관리 가능
    if (request.user?.role === 'teacher' && teacherId !== request.user.id) {
      return NextResponse.json(
        { error: '자신의 스케줄만 관리할 수 있습니다.' },
        { status: 403 }
      )
    }

    // 쉬는시간으로 설정하려는 경우, 1일 최대 8개 제한 확인
    if (isBreak) {
      const { data: existingBreaks, error: countError } = await supabase
        .from('reservation_slots')
        .select('id')
        .eq('date', date)
        .eq('teacher_id', teacherId)
        .eq('is_available', false) // 쉬는시간 = is_available이 false

      if (countError) {
        console.error('Error counting existing breaks:', countError)
        return NextResponse.json(
          { error: '쉬는시간 개수 확인 중 오류가 발생했습니다.' },
          { status: 500 }
        )
      }

      if (existingBreaks && existingBreaks.length >= 8) {
        return NextResponse.json(
          { error: '하루에 최대 8개의 쉬는시간만 설정할 수 있습니다.' },
          { status: 400 }
        )
      }
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
})