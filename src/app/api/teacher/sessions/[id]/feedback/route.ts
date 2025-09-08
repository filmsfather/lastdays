import { NextRequest, NextResponse } from 'next/server'
import { getCurrentUser } from '@/lib/auth'
import { supabase } from '@/lib/supabase'

// POST /api/teacher/sessions/[id]/feedback - 서면 피드백 작성
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
        { error: '교사만 피드백을 작성할 수 있습니다.' },
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
    const { content, feedbackType = 'general' } = body

    // 피드백 내용 유효성 검증
    if (!content || typeof content !== 'string' || content.trim().length === 0) {
      return NextResponse.json(
        { error: '피드백 내용을 입력해주세요.' },
        { status: 400 }
      )
    }

    if (content.length > 2000) {
      return NextResponse.json(
        { error: '피드백 내용은 2000자를 초과할 수 없습니다.' },
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
        { error: '담당 교사만 피드백을 작성할 수 있습니다.' },
        { status: 403 }
      )
    }

    // 피드백 저장
    const { data: newFeedback, error: insertError } = await supabase
      .from('feedbacks')
      .insert({
        session_id: sessionId,
        content: content.trim(),
        feedback_type: feedbackType,
        given_by: currentUser.id
      })
      .select(`
        *,
        giver:given_by (
          id,
          name,
          class_name
        )
      `)
      .single()

    if (insertError) {
      console.error('Feedback insert error:', insertError)
      return NextResponse.json(
        { error: '피드백 저장 중 오류가 발생했습니다.' },
        { status: 500 }
      )
    }

    return NextResponse.json({
      success: true,
      message: '피드백이 저장되었습니다.',
      data: {
        feedbackId: newFeedback.id,
        sessionId,
        content: newFeedback.content,
        feedbackType: newFeedback.feedback_type,
        giver: newFeedback.giver,
        createdAt: newFeedback.created_at
      }
    })

  } catch (error) {
    console.error('Create feedback error:', error)
    return NextResponse.json(
      { error: '서버 오류가 발생했습니다.' },
      { status: 500 }
    )
  }
}

// PATCH /api/teacher/sessions/[id]/feedback - 서면 피드백 수정
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
        { error: '교사만 피드백을 수정할 수 있습니다.' },
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
    const { feedbackId, content, feedbackType } = body

    // 필수 필드 확인
    if (!feedbackId) {
      return NextResponse.json(
        { error: '수정할 피드백 ID가 필요합니다.' },
        { status: 400 }
      )
    }

    // 피드백 내용 유효성 검증
    if (content !== undefined) {
      if (!content || typeof content !== 'string' || content.trim().length === 0) {
        return NextResponse.json(
          { error: '피드백 내용을 입력해주세요.' },
          { status: 400 }
        )
      }

      if (content.length > 2000) {
        return NextResponse.json(
          { error: '피드백 내용은 2000자를 초과할 수 없습니다.' },
          { status: 400 }
        )
      }
    }

    // 기존 피드백 확인 및 권한 검증
    const { data: existingFeedback, error: feedbackError } = await supabase
      .from('feedbacks')
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
      .eq('id', feedbackId)
      .eq('session_id', sessionId)
      .single()

    if (feedbackError || !existingFeedback) {
      return NextResponse.json(
        { error: '피드백을 찾을 수 없습니다.' },
        { status: 404 }
      )
    }

    // 작성자 또는 담당 교사 확인
    const isAuthor = existingFeedback.given_by === currentUser.id
    const isTeacher = existingFeedback.session.reservation.slot.teacher_id === currentUser.id

    if (!isAuthor && !isTeacher) {
      return NextResponse.json(
        { error: '해당 피드백을 수정할 권한이 없습니다.' },
        { status: 403 }
      )
    }

    // 업데이트할 필드 구성
    const updateData: any = {}
    if (content !== undefined) updateData.content = content.trim()
    if (feedbackType !== undefined) updateData.feedback_type = feedbackType

    if (Object.keys(updateData).length === 0) {
      return NextResponse.json(
        { error: '수정할 내용이 없습니다.' },
        { status: 400 }
      )
    }

    // 피드백 업데이트
    const { data: updatedFeedback, error: updateError } = await supabase
      .from('feedbacks')
      .update(updateData)
      .eq('id', feedbackId)
      .select(`
        *,
        giver:given_by (
          id,
          name,
          class_name
        )
      `)
      .single()

    if (updateError) {
      console.error('Feedback update error:', updateError)
      return NextResponse.json(
        { error: '피드백 수정 중 오류가 발생했습니다.' },
        { status: 500 }
      )
    }

    return NextResponse.json({
      success: true,
      message: '피드백이 수정되었습니다.',
      data: {
        feedbackId: updatedFeedback.id,
        sessionId,
        content: updatedFeedback.content,
        feedbackType: updatedFeedback.feedback_type,
        giver: updatedFeedback.giver,
        updatedAt: updatedFeedback.updated_at
      }
    })

  } catch (error) {
    console.error('Update feedback error:', error)
    return NextResponse.json(
      { error: '서버 오류가 발생했습니다.' },
      { status: 500 }
    )
  }
}