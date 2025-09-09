import { NextRequest, NextResponse } from 'next/server'
import { getCurrentUser } from '@/lib/auth'
import { supabase } from '@/lib/supabase'

// GET /api/hall-of-fame - 명예의 전당 우수 세션 목록 조회
export async function GET(request: NextRequest) {
  try {
    // 사용자 인증 확인 (모든 역할 허용)
    const currentUser = await getCurrentUser()
    if (!currentUser) {
      return NextResponse.json(
        { error: '인증이 필요합니다.' },
        { status: 401 }
      )
    }

    // 우수한 점수를 받은 완료된 세션들 조회
    const { data: sessions, error } = await supabase
      .from('sessions')
      .select(`
        id,
        status,
        completed_at,
        scores (
          practical_skills,
          major_knowledge,
          major_suitability,
          attitude
        ),
        reservation:reservation_id (
          student:student_id (
            name,
            class_name
          ),
          slot:slot_id (
            date,
            session_period,
            teacher:teacher_id (
              name,
              class_name
            )
          )
        ),
        problem:problem_id (
          title,
          limit_minutes
        )
      `)
      .eq('status', 'completed')
      .not('scores', 'is', null) // 점수가 있는 세션만
      .order('completed_at', { ascending: false })
      .limit(100) // 최대 100건

    if (error) {
      console.error('Hall of Fame query error:', error)
      return NextResponse.json(
        { error: '데이터 조회 실패' },
        { status: 500 }
      )
    }

    // 우수한 점수만 필터링
    const excellentSessions = sessions?.filter(session => {
      const scores = Array.isArray(session.scores) ? session.scores[0] : session.scores
      if (!scores) return false

      const scoreValues = [
        scores.practical_skills,
        scores.major_knowledge,
        scores.major_suitability,
        scores.attitude
      ]

      // 모든 점수가 '상' 또는 최대 1개만 '중상'인 경우
      const 상Count = scoreValues.filter(s => s === '상').length
      const 중상Count = scoreValues.filter(s => s === '중상').length

      return 상Count >= 3 && (상Count === 4 || 중상Count === 1)
    }) || []

    // 응답 데이터 구성
    const hallOfFameData = excellentSessions.map(session => {
      const scores = Array.isArray(session.scores) ? session.scores[0] : session.scores
      const problem = Array.isArray(session.problem) ? session.problem[0] : session.problem
      return {
        id: session.id,
        date: (session.reservation as any).slot.date,
        sessionPeriod: (session.reservation as any).slot.session_period,
        studentName: (session.reservation as any).student.name,
        studentClass: (session.reservation as any).student.class_name,
        teacherName: (session.reservation as any).slot.teacher.name,
        teacherClass: (session.reservation as any).slot.teacher.class_name,
        problemTitle: problem?.title || '문제 정보 없음',
        limitMinutes: problem?.limit_minutes || 0,
        completedAt: session.completed_at,
        scores: {
          practical_skills: scores?.practical_skills || '',
          major_knowledge: scores?.major_knowledge || '',
          major_suitability: scores?.major_suitability || '',
          attitude: scores?.attitude || ''
        }
      }
    })

    return NextResponse.json({
      success: true,
      data: hallOfFameData
    })

  } catch (error) {
    console.error('Hall of Fame API error:', error)
    return NextResponse.json(
      { error: '서버 오류가 발생했습니다.' },
      { status: 500 }
    )
  }
}