import { NextRequest, NextResponse } from 'next/server'
import { withAdmin } from '@/lib/middleware'
import { supabase } from '@/lib/supabase'

// 주간 스케줄 조회 API
export const GET = withAdmin(async (request) => {
  try {
    const { searchParams } = new URL(request.url)
    const weekStart = searchParams.get('weekStart')

    if (!weekStart) {
      return NextResponse.json(
        { error: '주간 시작일이 필요합니다.' },
        { status: 400 }
      )
    }

    // 주간 날짜 범위 계산 (월요일부터 일요일까지)
    const startDate = new Date(weekStart)
    const endDate = new Date(startDate)
    endDate.setDate(startDate.getDate() + 6)

    // 주간 타임슬롯 조회 (교사 정보 포함)
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
        accounts!inner(name, class_name)
      `)
      .gte('date', startDate.toISOString().split('T')[0])
      .lte('date', endDate.toISOString().split('T')[0])
      .order('date', { ascending: true })
      .order('time_slot', { ascending: true })

    if (error) {
      console.error('Error fetching weekly schedule:', error)
      return NextResponse.json(
        { error: '주간 스케줄 조회 중 오류가 발생했습니다.' },
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
      teacher_class: (slot.accounts as any)?.class_name,
      max_capacity: slot.max_capacity,
      current_reservations: slot.current_reservations,
      is_available: slot.is_available
    })) || []

    return NextResponse.json({
      success: true,
      weekStart: startDate.toISOString().split('T')[0],
      weekEnd: endDate.toISOString().split('T')[0],
      slots: formattedSlots
    })

  } catch (error) {
    console.error('Weekly schedule error:', error)
    return NextResponse.json(
      { error: '서버 오류가 발생했습니다.' },
      { status: 500 }
    )
  }
})