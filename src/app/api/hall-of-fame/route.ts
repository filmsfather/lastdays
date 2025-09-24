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

    // 우수도 점수 계산 함수
    const calculateExcellenceScore = (scores: any) => {
      const scoreMap = { '상': 4, '중상': 3, '중': 2, '중하': 1, '하': 0 } as const
      return Object.values(scores).reduce((sum: number, score: any) => sum + (scoreMap[score as keyof typeof scoreMap] || 0), 0)
    }

    // 우수한 점수만 필터링 (15점 이상)
    const excellentSessions = sessions?.filter(session => {
      const scores = Array.isArray(session.scores) ? session.scores[0] : session.scores
      if (!scores) return false

      const totalScore = calculateExcellenceScore(scores)
      return totalScore >= 15 // 15점 이상만
    }) || []

    // 점수 기준 정렬 후 상위 30개만 선택
    const topExcellentSessions = excellentSessions
      .sort((a, b) => {
        const scoresA = Array.isArray(a.scores) ? a.scores[0] : a.scores
        const scoresB = Array.isArray(b.scores) ? b.scores[0] : b.scores
        const scoreA = calculateExcellenceScore(scoresA)
        const scoreB = calculateExcellenceScore(scoresB)
        return scoreB - scoreA // 높은 점수부터
      })
      .slice(0, 30) // 상위 30개만

    // 응답 데이터 구성
    const hallOfFameData = topExcellentSessions.map(session => {
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