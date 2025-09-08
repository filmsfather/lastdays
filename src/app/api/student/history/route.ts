import { NextResponse } from 'next/server'
import { getCurrentUser } from '@/lib/auth'
import { supabase } from '@/lib/supabase'

interface SessionData {
  id: number
  status: string
  started_at: string
  completed_at: string
  reservation: {
    slot: {
      date: string
      time_slot: string
      session_period: string
      teacher: {
        name: string
      }
    }
  }
  problem: {
    title: string
  }
  scores: Array<{
    total_score: number
  }>
}

// GET /api/student/history - 학생 세션 히스토리 조회 (최신 50건)
export async function GET() {
  try {
    const currentUser = await getCurrentUser()
    if (!currentUser) {
      return NextResponse.json(
        { error: '로그인이 필요합니다.' },
        { status: 401 }
      )
    }

    if (currentUser.role !== 'student') {
      return NextResponse.json(
        { error: '학생만 접근 가능합니다.' },
        { status: 403 }
      )
    }

    // 학생의 최근 50건 세션 히스토리 조회
    const { data: sessions, error } = await supabase
      .from('sessions')
      .select(`
        id,
        status,
        started_at,
        completed_at,
        reservation:reservation_id (
          slot:slot_id (
            date,
            time_slot,
            session_period,
            teacher:teacher_id (
              name
            )
          )
        ),
        problem:problem_id (
          title
        ),
        scores (
          total_score
        )
      `)
      .eq('reservation.student_id', currentUser.id)
      .eq('status', 'completed')
      .order('completed_at', { ascending: false })
      .limit(50)

    if (error) {
      console.error('Error fetching student history:', error)
      return NextResponse.json(
        { error: '히스토리 조회 중 오류가 발생했습니다.' },
        { status: 500 }
      )
    }

    // 데이터 형식 변환
    const formattedSessions = (sessions as any[]).map((session: any) => ({
      id: session.id,
      date: session.reservation?.slot?.date,
      timeSlot: session.reservation?.slot?.time_slot,
      sessionPeriod: session.reservation?.slot?.session_period,
      teacherName: session.reservation?.slot?.teacher?.name,
      problemTitle: session.problem?.title,
      finalScore: session.scores?.[0]?.total_score || 0,
      completedAt: session.completed_at
    }))

    return NextResponse.json({
      success: true,
      sessions: formattedSessions
    })

  } catch (error) {
    console.error('Get student history error:', error)
    return NextResponse.json(
      { error: '서버 오류가 발생했습니다.' },
      { status: 500 }
    )
  }
}