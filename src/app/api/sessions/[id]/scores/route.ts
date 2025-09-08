import { NextRequest, NextResponse } from 'next/server'
import { getCurrentUser } from '@/lib/auth'
import { supabase } from '@/lib/supabase'

// POST /api/sessions/[id]/scores - 점수 저장
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const currentUser = await getCurrentUser()
    if (!currentUser || currentUser.role !== 'teacher') {
      return NextResponse.json(
        { error: '교사만 점수를 등록할 수 있습니다.' },
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
    const { practical_skills, major_knowledge, major_suitability, attitude } = body

    // 입력 검증
    if (!practical_skills || !major_knowledge || !major_suitability || !attitude) {
      return NextResponse.json(
        { error: '모든 점수 항목을 입력해주세요.' },
        { status: 400 }
      )
    }

    // 점수 범위 검증 (상,중상,중,중하,하)
    const validScores = ['상', '중상', '중', '중하', '하']
    const scores = [practical_skills, major_knowledge, major_suitability, attitude]
    if (scores.some(score => !validScores.includes(score))) {
      return NextResponse.json(
        { error: '점수는 상, 중상, 중, 중하, 하 중 하나여야 합니다.' },
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

    // 기존 점수가 있는지 확인
    const { data: existingScore } = await supabase
      .from('scores')
      .select('id')
      .eq('session_id', sessionId)
      .single()

    if (existingScore) {
      // 기존 점수 업데이트
      const { error: updateError } = await supabase
        .from('scores')
        .update({
          practical_skills,
          major_knowledge,
          major_suitability,
          attitude,
          scored_by: currentUser.id,
          updated_at: new Date().toISOString()
        })
        .eq('session_id', sessionId)

      if (updateError) {
        console.error('Score update error:', updateError)
        return NextResponse.json(
          { error: '점수 업데이트 중 오류가 발생했습니다.' },
          { status: 500 }
        )
      }
    } else {
      // 새 점수 생성
      const { error: insertError } = await supabase
        .from('scores')
        .insert({
          session_id: sessionId,
          practical_skills,
          major_knowledge,
          major_suitability,
          attitude,
          scored_by: currentUser.id
        })

      if (insertError) {
        console.error('Score insert error:', insertError)
        return NextResponse.json(
          { error: '점수 저장 중 오류가 발생했습니다.' },
          { status: 500 }
        )
      }
    }

    return NextResponse.json({
      success: true,
      message: '점수가 저장되었습니다.'
    })

  } catch (error) {
    console.error('Score save error:', error)
    return NextResponse.json(
      { error: '서버 오류가 발생했습니다.' },
      { status: 500 }
    )
  }
}