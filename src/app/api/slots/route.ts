import { NextRequest, NextResponse } from 'next/server'
import { getCurrentUser } from '@/lib/auth'
import { supabase } from '@/lib/supabase'

// 예약 가능한 슬롯 조회 API
export async function GET(req: NextRequest) {
  try {
    const user = await getCurrentUser()

    if (!user) {
      return NextResponse.json(
        { error: '인증이 필요합니다.' },
        { status: 401 }
      )
    }

    // 학생만 슬롯을 조회할 수 있음
    if (user.role !== 'student') {
      return NextResponse.json(
        { error: '학생만 슬롯을 조회할 수 있습니다.' },
        { status: 403 }
      )
    }

    const { searchParams } = new URL(req.url)
    const fromDate = searchParams.get('from')
    const toDate = searchParams.get('to')
    
    // 날짜 범위가 지정되지 않은 경우 현재 날짜부터 조회
    const startDate = fromDate || new Date().toISOString().split('T')[0]
    const endDate = toDate || null

    // reservation_slots 테이블에서 예약 가능한 슬롯 조회 (타임슬롯 시스템)
    let query = supabase
      .from('reservation_slots')
      .select(`
        id,
        date,
        time_slot,
        session_period,
        max_capacity,
        current_reservations,
        is_available,
        teacher:teacher_id(name)
      `)
      .gte('date', startDate)
      .eq('is_available', true)
      .order('date', { ascending: true })
      .order('session_period', { ascending: true })
      .order('time_slot', { ascending: true })

    // 종료 날짜가 있으면 범위 제한
    if (endDate) {
      query = query.lte('date', endDate)
    }

    const { data: slots, error } = await query

    if (error) {
      console.error('Error fetching slots:', error)
      return NextResponse.json(
        { error: '슬롯 정보 조회 중 오류가 발생했습니다.' },
        { status: 500 }
      )
    }

    // 예약 가능한 슬롯만 필터링하고 응답 형태 변환 (타임슬롯 시스템)
    const availableSlots = slots?.map(slot => ({
      id: slot.id,
      date: slot.date,
      time_slot: slot.time_slot,
      session_period: slot.session_period,
      teacher_name: (slot.teacher as any)?.name || '알 수 없음',
      max_capacity: slot.max_capacity,
      current_reservations: slot.current_reservations,
      is_available: slot.is_available,
      available: slot.current_reservations < slot.max_capacity && slot.is_available
    })) || []

    return NextResponse.json({
      success: true,
      slots: availableSlots
    })
  } catch (error) {
    console.error('Get slots error:', error)
    return NextResponse.json(
      { error: '슬롯 조회 중 오류가 발생했습니다.' },
      { status: 500 }
    )
  }
}