import { NextRequest, NextResponse } from 'next/server'
import { getCurrentUser } from '@/lib/auth'
import { supabase } from '@/lib/supabase'

// POST /api/sessions/[id]/checklist/[itemId]/toggle - 체크리스트 완료 상태 토글
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; itemId: string }> }
) {
  try {
    const currentUser = await getCurrentUser()
    if (!currentUser) {
      return NextResponse.json(
        { error: '로그인이 필요합니다.' },
        { status: 401 }
      )
    }

    // 학생 권한 확인
    if (currentUser.role !== 'student') {
      return NextResponse.json(
        { error: '학생만 체크리스트를 완료 처리할 수 있습니다.' },
        { status: 403 }
      )
    }

    const resolvedParams = await params
    const sessionId = parseInt(resolvedParams.id)
    const itemId = parseInt(resolvedParams.itemId)
    
    if (isNaN(sessionId)) {
      return NextResponse.json(
        { error: '올바른 세션 ID가 아닙니다.' },
        { status: 400 }
      )
    }

    if (isNaN(itemId)) {
      return NextResponse.json(
        { error: '올바른 체크리스트 항목 ID가 아닙니다.' },
        { status: 400 }
      )
    }

    // 체크리스트 항목 존재 및 권한 확인
    const { data: checklistItem, error: itemError } = await supabase
      .from('checklist_items')
      .select(`
        *,
        session:session_id (
          id,
          reservation:reservation_id (
            id,
            student_id,
            student:student_id (
              id,
              name,
              class_name
            )
          )
        )
      `)
      .eq('id', itemId)
      .eq('session_id', sessionId)
      .single()

    if (itemError || !checklistItem) {
      return NextResponse.json(
        { error: '체크리스트 항목을 찾을 수 없습니다.' },
        { status: 404 }
      )
    }

    // 본인의 세션인지 확인
    if (checklistItem.session.reservation.student_id !== currentUser.id) {
      return NextResponse.json(
        { error: '본인의 세션 체크리스트만 완료 처리할 수 있습니다.' },
        { status: 403 }
      )
    }

    // 체크 상태 토글
    const newCheckedStatus = !checklistItem.is_checked
    const checkedBy = newCheckedStatus ? currentUser.id : null

    const { data: updatedItem, error: updateError } = await supabase
      .from('checklist_items')
      .update({
        is_checked: newCheckedStatus,
        checked_by: checkedBy
      })
      .eq('id', itemId)
      .select(`
        *,
        checker:checked_by (
          id,
          name,
          class_name
        )
      `)
      .single()

    if (updateError) {
      console.error('Checklist toggle error:', updateError)
      return NextResponse.json(
        { error: '체크리스트 상태 변경 중 오류가 발생했습니다.' },
        { status: 500 }
      )
    }

    return NextResponse.json({
      success: true,
      message: newCheckedStatus ? '체크리스트 항목이 완료 처리되었습니다.' : '체크리스트 항목 완료가 취소되었습니다.',
      data: {
        itemId: updatedItem.id,
        sessionId,
        itemText: updatedItem.item_text,
        isChecked: updatedItem.is_checked,
        checkedBy: updatedItem.checker,
        updatedAt: updatedItem.updated_at
      }
    })

  } catch (error) {
    console.error('Toggle checklist item error:', error)
    return NextResponse.json(
      { error: '서버 오류가 발생했습니다.' },
      { status: 500 }
    )
  }
}