import { NextRequest, NextResponse } from 'next/server'
import { getCurrentUser } from '@/lib/auth'
import { supabase } from '@/lib/supabase'

// POST /api/sessions/[id]/feedback - 피드백 저장
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const currentUser = await getCurrentUser()
    if (!currentUser || currentUser.role !== 'teacher') {
      return NextResponse.json(
        { error: '교사만 피드백을 등록할 수 있습니다.' },
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
    const { content } = body

    // 입력 검증
    if (!content || content.trim().length === 0) {
      return NextResponse.json(
        { error: '피드백 내용을 입력해주세요.' },
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

    // 피드백 저장
    const { error: insertError } = await supabase
      .from('feedbacks')
      .insert({
        session_id: sessionId,
        content: content.trim(),
        feedback_type: 'general',
        given_by: currentUser.id
      })

    if (insertError) {
      console.error('Feedback insert error:', insertError)
      return NextResponse.json(
        { error: '피드백 저장 중 오류가 발생했습니다.' },
        { status: 500 }
      )
    }

    return NextResponse.json({
      success: true,
      message: '피드백이 저장되었습니다.'
    })

  } catch (error) {
    console.error('Feedback save error:', error)
    return NextResponse.json(
      { error: '서버 오류가 발생했습니다.' },
      { status: 500 }
    )
  }
}