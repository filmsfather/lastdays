import { NextRequest, NextResponse } from 'next/server'
import { getCurrentUser } from '@/lib/auth'
import { supabase } from '@/lib/supabase'

// GET /api/admin/slots/[id]/reservations - 슬롯의 예약 목록 조회
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const currentUser = await getCurrentUser()
    if (!currentUser || currentUser.role !== 'admin') {
      return NextResponse.json(
        { error: '관리자 권한이 필요합니다.' },
        { status: 403 }
      )
    }

    const resolvedParams = await params
    const slotId = parseInt(resolvedParams.id)
    if (isNaN(slotId)) {
      return NextResponse.json(
        { error: '올바른 슬롯 ID가 아닙니다.' },
        { status: 400 }
      )
    }

    // 해당 슬롯의 활성 예약 목록 조회
    const { data: reservations, error } = await supabase
      .from('reservations')
      .select(`
        id,
        student_id,
        status,
        created_at,
        student:student_id (
          id,
          name,
          class_name
        )
      `)
      .eq('slot_id', slotId)
      .eq('status', 'active')
      .order('created_at', { ascending: false })

    if (error) {
      console.error('Error fetching slot reservations:', error)
      return NextResponse.json(
        { error: '예약 목록 조회에 실패했습니다.' },
        { status: 500 }
      )
    }

    const formattedReservations = reservations.map(reservation => ({
      id: reservation.id,
      student_id: reservation.student_id,
      student_name: (reservation.student as any)?.name || 'Unknown',
      student_class: (reservation.student as any)?.class_name || 'Unknown',
      status: reservation.status,
      created_at: reservation.created_at
    }))

    return NextResponse.json({
      success: true,
      reservations: formattedReservations
    })

  } catch (error) {
    console.error('Get slot reservations error:', error)
    return NextResponse.json(
      { error: '서버 오류가 발생했습니다.' },
      { status: 500 }
    )
  }
}