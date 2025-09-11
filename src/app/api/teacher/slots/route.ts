import { NextRequest, NextResponse } from 'next/server'
import { withTeacherOrAdmin } from '@/lib/middleware'
import { supabase } from '@/lib/supabase'

// 선생님/관리자용 타임슬롯 조회 API
export const GET = withTeacherOrAdmin(async (request) => {
  try {
    const { searchParams } = new URL(request.url)
    const date = searchParams.get('date')
    const teacherId = searchParams.get('teacherId')

    if (!date) {
      return NextResponse.json(
        { error: '날짜는 필수입니다.' },
        { status: 400 }
      )
    }

    // 선생님은 자신의 스케줄만 조회 가능
    let actualTeacherId = teacherId
    if (request.user?.role === 'teacher') {
      if (teacherId && teacherId !== request.user.id.toString()) {
        return NextResponse.json(
          { error: '자신의 스케줄만 조회할 수 있습니다.' },
          { status: 403 }
        )
      }
      actualTeacherId = request.user.id.toString()
    }

    if (!actualTeacherId) {
      return NextResponse.json(
        { error: '교사 ID는 필수입니다.' },
        { status: 400 }
      )
    }

    // 타임슬롯 조회
    const { data: slots, error } = await supabase
      .from('reservation_slots')
      .select(`
        id,
        date,
        time_slot,
        session_period,
        teacher_id,
        max_capacity,
        current_reservations,
        is_available,
        accounts!inner(name)
      `)
      .eq('date', date)
      .eq('teacher_id', actualTeacherId)
      .order('time_slot', { ascending: true })

    if (error) {
      console.error('Error fetching time slots:', error)
      return NextResponse.json(
        { error: '타임슬롯 조회 중 오류가 발생했습니다.' },
        { status: 500 }
      )
    }

    // 응답 데이터 포맷 변환
    const formattedSlots = slots?.map(slot => ({
      id: slot.id,
      date: slot.date,
      time_slot: slot.time_slot,
      session_period: slot.session_period,
      teacher_id: slot.teacher_id,
      teacher_name: (slot.accounts as any)?.name,
      max_capacity: slot.max_capacity,
      current_reservations: slot.current_reservations,
      is_available: slot.is_available
    })) || []

    return NextResponse.json({
      success: true,
      slots: formattedSlots
    })

  } catch (error) {
    console.error('Get timeslots error:', error)
    return NextResponse.json(
      { error: '서버 오류가 발생했습니다.' },
      { status: 500 }
    )
  }
})