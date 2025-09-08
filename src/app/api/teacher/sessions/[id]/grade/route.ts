import { NextRequest, NextResponse } from 'next/server'
import { getCurrentUser } from '@/lib/auth'
import { supabase } from '@/lib/supabase'

// POST /api/teacher/sessions/[id]/grade - 교사 전용 4항목 채점 시스템
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
        { error: '교사만 채점할 수 있습니다.' },
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
    const { 
      problemUnderstanding, 
      solutionApproach, 
      calculationAccuracy, 
      presentationClarity 
    } = body

    // 점수 유효성 검증
    const scores = [
      { name: 'problemUnderstanding', value: problemUnderstanding },
      { name: 'solutionApproach', value: solutionApproach },
      { name: 'calculationAccuracy', value: calculationAccuracy },
      { name: 'presentationClarity', value: presentationClarity }
    ]

    for (const score of scores) {
      if (score.value !== undefined && score.value !== null) {
        if (!Number.isInteger(score.value) || score.value < 1 || score.value > 5) {
          return NextResponse.json(
            { error: `${score.name}는 1-5 사이의 정수여야 합니다.` },
            { status: 400 }
          )
        }
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
        { error: '담당 교사만 채점할 수 있습니다.' },
        { status: 403 }
      )
    }

    // 기존 점수가 있는지 확인
    const { data: existingScore, error: existingError } = await supabase
      .from('scores')
      .select('*')
      .eq('session_id', sessionId)
      .single()

    let result
    if (existingScore) {
      // 기존 점수 업데이트
      const updateData: any = { scored_by: currentUser.id }
      
      if (problemUnderstanding !== undefined) updateData.problem_understanding = problemUnderstanding
      if (solutionApproach !== undefined) updateData.solution_approach = solutionApproach
      if (calculationAccuracy !== undefined) updateData.calculation_accuracy = calculationAccuracy
      if (presentationClarity !== undefined) updateData.presentation_clarity = presentationClarity

      const { data: updatedScore, error: updateError } = await supabase
        .from('scores')
        .update(updateData)
        .eq('session_id', sessionId)
        .select(`
          *,
          scorer:scored_by (
            id,
            name,
            class_name
          )
        `)
        .single()

      if (updateError) {
        console.error('Score update error:', updateError)
        return NextResponse.json(
          { error: '점수 업데이트 중 오류가 발생했습니다.' },
          { status: 500 }
        )
      }

      result = updatedScore
    } else {
      // 새 점수 생성
      const { data: newScore, error: insertError } = await supabase
        .from('scores')
        .insert({
          session_id: sessionId,
          problem_understanding: problemUnderstanding,
          solution_approach: solutionApproach,
          calculation_accuracy: calculationAccuracy,
          presentation_clarity: presentationClarity,
          scored_by: currentUser.id
        })
        .select(`
          *,
          scorer:scored_by (
            id,
            name,
            class_name
          )
        `)
        .single()

      if (insertError) {
        console.error('Score insert error:', insertError)
        return NextResponse.json(
          { error: '점수 저장 중 오류가 발생했습니다.' },
          { status: 500 }
        )
      }

      result = newScore
    }

    // 세션 상태를 피드백 대기 중으로 업데이트 (아직 active인 경우)
    if (session.status === 'active') {
      await supabase
        .from('sessions')
        .update({ status: 'feedback_pending' })
        .eq('id', sessionId)
    }

    return NextResponse.json({
      success: true,
      message: '채점이 저장되었습니다.',
      data: {
        sessionId,
        scores: {
          problemUnderstanding: result.problem_understanding,
          solutionApproach: result.solution_approach,
          calculationAccuracy: result.calculation_accuracy,
          presentationClarity: result.presentation_clarity,
          totalScore: result.total_score
        },
        scorer: result.scorer,
        gradedAt: result.updated_at
      }
    })

  } catch (error) {
    console.error('Grade session error:', error)
    return NextResponse.json(
      { error: '서버 오류가 발생했습니다.' },
      { status: 500 }
    )
  }
}