import { NextRequest, NextResponse } from 'next/server'
import { getCurrentUser } from '@/lib/auth'
import { supabase } from '@/lib/supabase'

// PATCH /api/sessions/[id]/checklist/[itemId] - 체크리스트 항목 체크/언체크
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; itemId: string }> }
) {
  try {
    const currentUser = await getCurrentUser()
    if (!currentUser || currentUser.role !== 'student') {
      return NextResponse.json(
        { error: '학생만 체크리스트를 체크할 수 있습니다.' },
        { status: 403 }
      )
    }

    const resolvedParams = await params
    const sessionId = parseInt(resolvedParams.id)
    const itemId = parseInt(resolvedParams.itemId)
    
    if (isNaN(sessionId) || isNaN(itemId)) {
      return NextResponse.json(
        { error: '올바른 ID가 아닙니다.' },
        { status: 400 }
      )
    }

    const body = await request.json()
    const { is_checked } = body

    // 입력 검증
    if (typeof is_checked !== 'boolean') {
      return NextResponse.json(
        { error: '올바른 체크 상태를 전달해주세요.' },
        { status: 400 }
      )
    }

    // 체크리스트 항목 존재 확인 및 권한 확인
    const { data: item, error: itemError } = await supabase
      .from('checklist_items')
      .select(`
        id,
        session_id,
        item_text,
        is_checked
      `)
      .eq('id', itemId)
      .eq('session_id', sessionId)
      .single()

    if (itemError || !item) {
      return NextResponse.json(
        { error: '체크리스트 항목을 찾을 수 없습니다.' },
        { status: 404 }
      )
    }

    // 세션에 대한 학생 권한 확인 - 단계별 조회
    const { data: session, error: sessionError } = await supabase
      .from('sessions')
      .select('reservation_id')
      .eq('id', sessionId)
      .single()

    if (sessionError || !session) {
      return NextResponse.json(
        { error: '세션을 찾을 수 없습니다.' },
        { status: 404 }
      )
    }

    const { data: reservation, error: reservationError } = await supabase
      .from('reservations')
      .select('student_id')
      .eq('id', session.reservation_id)
      .single()

    if (reservationError || !reservation) {
      return NextResponse.json(
        { error: '예약 정보를 찾을 수 없습니다.' },
        { status: 404 }
      )
    }

    // 본인의 세션인지 확인
    if (reservation.student_id !== currentUser.id) {
      return NextResponse.json(
        { error: '본인의 세션 체크리스트만 수정할 수 있습니다.' },
        { status: 403 }
      )
    }

    // 체크리스트 항목 업데이트
    const { error: updateError } = await supabase
      .from('checklist_items')
      .update({
        is_checked,
        checked_by: is_checked ? currentUser.id : null,
        updated_at: new Date().toISOString()
      })
      .eq('id', itemId)

    if (updateError) {
      console.error('Checklist item update error:', updateError)
      return NextResponse.json(
        { error: '체크리스트 업데이트 중 오류가 발생했습니다.' },
        { status: 500 }
      )
    }

    return NextResponse.json({
      success: true,
      message: is_checked ? '체크리스트 항목이 체크되었습니다.' : '체크리스트 항목이 체크 해제되었습니다.'
    })

  } catch (error) {
    console.error('Checklist item toggle error:', error)
    return NextResponse.json(
      { error: '서버 오류가 발생했습니다.' },
      { status: 500 }
    )
  }
}