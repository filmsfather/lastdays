import { NextRequest, NextResponse } from 'next/server'
import { getCurrentUser } from '@/lib/auth'
import { supabase } from '@/lib/supabase'

// POST /api/sessions/[id]/checklist - 체크리스트 항목 추가
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const currentUser = await getCurrentUser()
    if (!currentUser || currentUser.role !== 'teacher') {
      return NextResponse.json(
        { error: '교사만 체크리스트를 추가할 수 있습니다.' },
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
    const { item_text } = body

    // 입력 검증
    if (!item_text || item_text.trim().length === 0) {
      return NextResponse.json(
        { error: '체크리스트 항목을 입력해주세요.' },
        { status: 400 }
      )
    }

    if (item_text.length > 200) {
      return NextResponse.json(
        { error: '체크리스트 항목은 200자를 초과할 수 없습니다.' },
        { status: 400 }
      )
    }

    // 세션 존재 확인
    const { data: session, error: sessionError } = await supabase
      .from('sessions')
      .select('id')
      .eq('id', sessionId)
      .single()

    if (sessionError || !session) {
      return NextResponse.json(
        { error: '세션을 찾을 수 없습니다.' },
        { status: 404 }
      )
    }

    // 체크리스트 항목 추가
    const { error: insertError } = await supabase
      .from('checklist_items')
      .insert({
        session_id: sessionId,
        item_text: item_text.trim(),
        is_checked: false
      })

    if (insertError) {
      console.error('Checklist item insert error:', insertError)
      return NextResponse.json(
        { error: '체크리스트 항목 추가 중 오류가 발생했습니다.' },
        { status: 500 }
      )
    }

    return NextResponse.json({
      success: true,
      message: '체크리스트 항목이 추가되었습니다.'
    })

  } catch (error) {
    console.error('Checklist item save error:', error)
    return NextResponse.json(
      { error: '서버 오류가 발생했습니다.' },
      { status: 500 }
    )
  }
}