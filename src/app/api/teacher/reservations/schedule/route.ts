import { NextRequest, NextResponse } from 'next/server'
import { getCurrentUser } from '@/lib/auth'
import { supabase } from '@/lib/supabase'

// 선생님별 예약 현황 조회 API
export async function GET(request: NextRequest) {
  try {
    const currentUser = await getCurrentUser()
    if (!currentUser) {
      return NextResponse.json(
        { error: '로그인이 필요합니다.' },
        { status: 401 }
      )
    }

    // 교사만 접근 가능
    if (currentUser.role !== 'teacher') {
      return NextResponse.json(
        { error: '교사만 접근 가능합니다.' },
        { status: 403 }
      )
    }

    const { searchParams } = new URL(request.url)
    const date = searchParams.get('date')

    if (!date) {
      return NextResponse.json(
        { error: '날짜가 필요합니다.' },
        { status: 400 }
      )
    }

    // 해당 날짜의 모든 슬롯과 예약 정보 조회
    const { data: slotsData, error: slotsError } = await supabase
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
        teacher:accounts!inner(
          id,
          name,
          class_name
        )
      `)
      .eq('date', date)
      .order('time_slot', { ascending: true })

    if (slotsError) {
      console.error('Error fetching slots:', slotsError)
      return NextResponse.json(
        { error: '슬롯 조회 중 오류가 발생했습니다.' },
        { status: 500 }
      )
    }

    // 각 슬롯의 예약 정보 조회
    const slotsWithReservations = await Promise.all(
      (slotsData || []).map(async (slot) => {
        if (slot.current_reservations > 0) {
          const { data: reservations, error: reservationError } = await supabase
            .from('reservations')
            .select(`
              id,
              student:student_id(
                id,
                name,
                class_name
              )
            `)
            .eq('slot_id', slot.id)
            .eq('status', 'active')

          if (reservationError) {
            console.error('Error fetching reservations for slot:', slot.id, reservationError)
            return {
              ...slot,
              teacher_name: (slot.teacher as any)?.name || '알 수 없음',
              teacher_class: (slot.teacher as any)?.class_name || '',
              students: []
            }
          }

          return {
            ...slot,
            teacher_name: (slot.teacher as any)?.name || '알 수 없음',
            teacher_class: (slot.teacher as any)?.class_name || '',
            students: reservations?.map(res => ({
              id: (res.student as any)?.id,
              student_name: (res.student as any)?.name || '알 수 없음',
              student_class: (res.student as any)?.class_name || ''
            })) || []
          }
        } else {
          return {
            ...slot,
            teacher_name: (slot.teacher as any)?.name || '알 수 없음',
            teacher_class: (slot.teacher as any)?.class_name || '',
            students: []
          }
        }
      })
    )

    return NextResponse.json({
      success: true,
      date,
      slots: slotsWithReservations
    })

  } catch (error) {
    console.error('Teacher reservations schedule error:', error)
    return NextResponse.json(
      { error: '서버 오류가 발생했습니다.' },
      { status: 500 }
    )
  }
}