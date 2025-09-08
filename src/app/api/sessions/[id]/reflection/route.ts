import { NextRequest, NextResponse } from 'next/server'
import { getCurrentUser } from '@/lib/auth'
import { supabase } from '@/lib/supabase'

// PATCH /api/sessions/[id]/reflection - 학생 복기 입력 및 수정
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

    // 학생 권한 확인
    if (currentUser.role !== 'student') {
      return NextResponse.json(
        { error: '학생만 복기를 작성할 수 있습니다.' },
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
    const { reflectionText, selfAssessment, areasForImprovement } = body

    // 복기 내용 유효성 검증
    if (reflectionText !== undefined) {
      if (!reflectionText || typeof reflectionText !== 'string' || reflectionText.trim().length === 0) {
        return NextResponse.json(
          { error: '복기 내용을 입력해주세요.' },
          { status: 400 }
        )
      }

      if (reflectionText.length > 2000) {
        return NextResponse.json(
          { error: '복기 내용은 2000자를 초과할 수 없습니다.' },
          { status: 400 }
        )
      }
    }

    // 자기 평가 점수 유효성 검증
    if (selfAssessment !== undefined) {
      if (!Number.isInteger(selfAssessment) || selfAssessment < 1 || selfAssessment > 5) {
        return NextResponse.json(
          { error: '자기 평가는 1-5 사이의 정수여야 합니다.' },
          { status: 400 }
        )
      }
    }

    // 개선 영역 유효성 검증
    if (areasForImprovement !== undefined && areasForImprovement !== null) {
      if (typeof areasForImprovement !== 'string') {
        return NextResponse.json(
          { error: '개선이 필요한 영역은 문자열이어야 합니다.' },
          { status: 400 }
        )
      }

      if (areasForImprovement.length > 1000) {
        return NextResponse.json(
          { error: '개선이 필요한 영역은 1000자를 초과할 수 없습니다.' },
          { status: 400 }
        )
      }
    }

    // 세션 존재 및 권한 확인
    const { data: session, error: sessionError } = await supabase
      .from('sessions')
      .select(`
        *,
        reservation:reservation_id (
          id,
          student_id,
          student:student_id (
            id,
            name,
            class_name
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

    // 본인의 세션인지 확인
    if (session.reservation.student_id !== currentUser.id) {
      return NextResponse.json(
        { error: '본인의 세션에만 복기를 작성할 수 있습니다.' },
        { status: 403 }
      )
    }

    // 기존 복기가 있는지 확인
    const { data: existingReflection, error: existingError } = await supabase
      .from('student_reflections')
      .select('*')
      .eq('session_id', sessionId)
      .single()

    // 업데이트할 데이터 구성
    const updateData: any = {}
    if (reflectionText !== undefined) updateData.reflection_text = reflectionText.trim()
    if (selfAssessment !== undefined) updateData.self_assessment = selfAssessment
    if (areasForImprovement !== undefined) {
      updateData.areas_for_improvement = areasForImprovement ? areasForImprovement.trim() : null
    }

    if (Object.keys(updateData).length === 0) {
      return NextResponse.json(
        { error: '수정할 내용이 없습니다.' },
        { status: 400 }
      )
    }

    let result
    if (existingReflection) {
      // 기존 복기 업데이트
      const { data: updatedReflection, error: updateError } = await supabase
        .from('student_reflections')
        .update(updateData)
        .eq('session_id', sessionId)
        .select('*')
        .single()

      if (updateError) {
        console.error('Reflection update error:', updateError)
        return NextResponse.json(
          { error: '복기 수정 중 오류가 발생했습니다.' },
          { status: 500 }
        )
      }

      result = updatedReflection
    } else {
      // 새 복기 생성
      // reflectionText는 필수 필드
      if (!updateData.reflection_text) {
        return NextResponse.json(
          { error: '복기 내용은 필수입니다.' },
          { status: 400 }
        )
      }

      const insertData = {
        session_id: sessionId,
        ...updateData
      }

      const { data: newReflection, error: insertError } = await supabase
        .from('student_reflections')
        .insert(insertData)
        .select('*')
        .single()

      if (insertError) {
        console.error('Reflection insert error:', insertError)
        return NextResponse.json(
          { error: '복기 저장 중 오류가 발생했습니다.' },
          { status: 500 }
        )
      }

      result = newReflection
    }

    return NextResponse.json({
      success: true,
      message: existingReflection ? '복기가 수정되었습니다.' : '복기가 저장되었습니다.',
      data: {
        reflectionId: result.id,
        sessionId,
        reflectionText: result.reflection_text,
        selfAssessment: result.self_assessment,
        areasForImprovement: result.areas_for_improvement,
        createdAt: result.created_at,
        updatedAt: result.updated_at
      }
    })

  } catch (error) {
    console.error('Student reflection error:', error)
    return NextResponse.json(
      { error: '서버 오류가 발생했습니다.' },
      { status: 500 }
    )
  }
}