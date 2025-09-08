import { NextRequest, NextResponse } from 'next/server'
import { getCurrentUser } from '@/lib/auth'
import { supabase } from '@/lib/supabase'

// POST /api/teacher/sessions/[id]/checklist - 체크리스트 항목 생성
export async function POST(
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

    // 교사 권한 확인
    if (currentUser.role !== 'teacher') {
      return NextResponse.json(
        { error: '교사만 체크리스트를 생성할 수 있습니다.' },
        { status: 403 }
      )
    }

    const resolvedParams = await params
    const sessionId = parseInt(resolvedParams.id)
    if (isNaN(sessionId)) {
      return NextResponse.json(
        { error: '올바른 세션 ID가 아닙니다.' },
        { status: 400 }
      )
    }

    const body = await request.json()
    const { itemText } = body

    // 체크리스트 항목 내용 유효성 검증
    if (!itemText || typeof itemText !== 'string' || itemText.trim().length === 0) {
      return NextResponse.json(
        { error: '체크리스트 항목 내용을 입력해주세요.' },
        { status: 400 }
      )
    }

    if (itemText.length > 200) {
      return NextResponse.json(
        { error: '체크리스트 항목은 200자를 초과할 수 없습니다.' },
        { status: 400 }
      )
    }

    // 세션 존재 및 권한 확인
    const { data: session, error: sessionError } = await supabase
      .from('sessions')
      .select(`
        *,
        reservation:reservation_id (
          id,
          student_id,
          slot:slot_id (
            teacher_id,
            teacher:teacher_id (
              id,
              name,
              class_name
            )
          )
        )
      `)
      .eq('id', sessionId)
      .single()

    if (sessionError || !session) {
      return NextResponse.json(
        { error: '세션을 찾을 수 없습니다.' },
        { status: 404 }
      )
    }

    // 담당 교사 확인
    if (session.reservation.slot.teacher_id !== currentUser.id) {
      return NextResponse.json(
        { error: '담당 교사만 체크리스트를 생성할 수 있습니다.' },
        { status: 403 }
      )
    }

    // 체크리스트 항목 생성
    const { data: newItem, error: insertError } = await supabase
      .from('checklist_items')
      .insert({
        session_id: sessionId,
        item_text: itemText.trim()
      })
      .select('*')
      .single()

    if (insertError) {
      console.error('Checklist item insert error:', insertError)
      return NextResponse.json(
        { error: '체크리스트 항목 저장 중 오류가 발생했습니다.' },
        { status: 500 }
      )
    }

    return NextResponse.json({
      success: true,
      message: '체크리스트 항목이 생성되었습니다.',
      data: {
        itemId: newItem.id,
        sessionId,
        itemText: newItem.item_text,
        isChecked: newItem.is_checked,
        createdAt: newItem.created_at
      }
    })

  } catch (error) {
    console.error('Create checklist item error:', error)
    return NextResponse.json(
      { error: '서버 오류가 발생했습니다.' },
      { status: 500 }
    )
  }
}

// PATCH /api/teacher/sessions/[id]/checklist - 체크리스트 항목 수정
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

    // 교사 권한 확인
    if (currentUser.role !== 'teacher') {
      return NextResponse.json(
        { error: '교사만 체크리스트를 수정할 수 있습니다.' },
        { status: 403 }
      )
    }

    const resolvedParams = await params
    const sessionId = parseInt(resolvedParams.id)
    if (isNaN(sessionId)) {
      return NextResponse.json(
        { error: '올바른 세션 ID가 아닙니다.' },
        { status: 400 }
      )
    }

    const body = await request.json()
    const { itemId, itemText } = body

    // 필수 필드 확인
    if (!itemId) {
      return NextResponse.json(
        { error: '수정할 체크리스트 항목 ID가 필요합니다.' },
        { status: 400 }
      )
    }

    // 체크리스트 항목 내용 유효성 검증
    if (itemText !== undefined) {
      if (!itemText || typeof itemText !== 'string' || itemText.trim().length === 0) {
        return NextResponse.json(
          { error: '체크리스트 항목 내용을 입력해주세요.' },
          { status: 400 }
        )
      }

      if (itemText.length > 200) {
        return NextResponse.json(
          { error: '체크리스트 항목은 200자를 초과할 수 없습니다.' },
          { status: 400 }
        )
      }
    }

    // 기존 체크리스트 항목 확인 및 권한 검증
    const { data: existingItem, error: itemError } = await supabase
      .from('checklist_items')
      .select(`
        *,
        session:session_id (
          reservation:reservation_id (
            slot:slot_id (
              teacher_id
            )
          )
        )
      `)
      .eq('id', itemId)
      .eq('session_id', sessionId)
      .single()

    if (itemError || !existingItem) {
      return NextResponse.json(
        { error: '체크리스트 항목을 찾을 수 없습니다.' },
        { status: 404 }
      )
    }

    // 담당 교사 확인
    if (existingItem.session.reservation.slot.teacher_id !== currentUser.id) {
      return NextResponse.json(
        { error: '담당 교사만 체크리스트를 수정할 수 있습니다.' },
        { status: 403 }
      )
    }

    // 업데이트할 필드 구성
    const updateData: any = {}
    if (itemText !== undefined) updateData.item_text = itemText.trim()

    if (Object.keys(updateData).length === 0) {
      return NextResponse.json(
        { error: '수정할 내용이 없습니다.' },
        { status: 400 }
      )
    }

    // 체크리스트 항목 업데이트
    const { data: updatedItem, error: updateError } = await supabase
      .from('checklist_items')
      .update(updateData)
      .eq('id', itemId)
      .select('*')
      .single()

    if (updateError) {
      console.error('Checklist item update error:', updateError)
      return NextResponse.json(
        { error: '체크리스트 항목 수정 중 오류가 발생했습니다.' },
        { status: 500 }
      )
    }

    return NextResponse.json({
      success: true,
      message: '체크리스트 항목이 수정되었습니다.',
      data: {
        itemId: updatedItem.id,
        sessionId,
        itemText: updatedItem.item_text,
        isChecked: updatedItem.is_checked,
        updatedAt: updatedItem.updated_at
      }
    })

  } catch (error) {
    console.error('Update checklist item error:', error)
    return NextResponse.json(
      { error: '서버 오류가 발생했습니다.' },
      { status: 500 }
    )
  }
}

// DELETE /api/teacher/sessions/[id]/checklist - 체크리스트 항목 삭제
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

    // 교사 권한 확인
    if (currentUser.role !== 'teacher') {
      return NextResponse.json(
        { error: '교사만 체크리스트를 삭제할 수 있습니다.' },
        { status: 403 }
      )
    }

    const resolvedParams = await params
    const sessionId = parseInt(resolvedParams.id)
    if (isNaN(sessionId)) {
      return NextResponse.json(
        { error: '올바른 세션 ID가 아닙니다.' },
        { status: 400 }
      )
    }

    // URL 쿼리에서 itemId 가져오기
    const { searchParams } = new URL(request.url)
    const itemIdStr = searchParams.get('itemId')
    
    if (!itemIdStr) {
      return NextResponse.json(
        { error: '삭제할 체크리스트 항목 ID가 필요합니다.' },
        { status: 400 }
      )
    }

    const itemId = parseInt(itemIdStr)
    if (isNaN(itemId)) {
      return NextResponse.json(
        { error: '올바른 체크리스트 항목 ID가 아닙니다.' },
        { status: 400 }
      )
    }

    // 기존 체크리스트 항목 확인 및 권한 검증
    const { data: existingItem, error: itemError } = await supabase
      .from('checklist_items')
      .select(`
        *,
        session:session_id (
          reservation:reservation_id (
            slot:slot_id (
              teacher_id
            )
          )
        )
      `)
      .eq('id', itemId)
      .eq('session_id', sessionId)
      .single()

    if (itemError || !existingItem) {
      return NextResponse.json(
        { error: '체크리스트 항목을 찾을 수 없습니다.' },
        { status: 404 }
      )
    }

    // 담당 교사 확인
    if (existingItem.session.reservation.slot.teacher_id !== currentUser.id) {
      return NextResponse.json(
        { error: '담당 교사만 체크리스트를 삭제할 수 있습니다.' },
        { status: 403 }
      )
    }

    // 체크리스트 항목 삭제
    const { error: deleteError } = await supabase
      .from('checklist_items')
      .delete()
      .eq('id', itemId)

    if (deleteError) {
      console.error('Checklist item delete error:', deleteError)
      return NextResponse.json(
        { error: '체크리스트 항목 삭제 중 오류가 발생했습니다.' },
        { status: 500 }
      )
    }

    return NextResponse.json({
      success: true,
      message: '체크리스트 항목이 삭제되었습니다.',
      data: {
        deletedItemId: itemId,
        sessionId
      }
    })

  } catch (error) {
    console.error('Delete checklist item error:', error)
    return NextResponse.json(
      { error: '서버 오류가 발생했습니다.' },
      { status: 500 }
    )
  }
}