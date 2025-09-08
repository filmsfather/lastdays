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

    // 1단계: 현재 학생의 예약 ID들 조회
    const { data: reservations, error: reservationError } = await supabase
      .from('reservations')
      .select('id')
      .eq('student_id', currentUser.id)

    if (reservationError) {
      console.error('Error fetching reservations:', reservationError)
      return NextResponse.json(
        { error: '예약 정보 조회 중 오류가 발생했습니다.' },
        { status: 500 }
      )
    }

    if (!reservations || reservations.length === 0) {
      return NextResponse.json({
        success: true,
        sessions: []
      })
    }

    const reservationIds = reservations.map(r => r.id)

    // 2단계: 해당 예약들의 완료된 세션 조회
    const { data: sessions, error } = await supabase
      .from('sessions')
      .select(`
        id,
        status,
        started_at,
        completed_at,
        reservation_id,
        problem_id
      `)
      .in('reservation_id', reservationIds)
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

    if (!sessions || sessions.length === 0) {
      return NextResponse.json({
        success: true,
        sessions: []
      })
    }

    // 3단계: 각 세션의 관련 데이터 조회
    const sessionData = await Promise.all(
      sessions.map(async (session: any) => {
        // 예약 정보 조회
        const { data: reservation } = await supabase
          .from('reservations')
          .select(`
            id,
            slot:slot_id (
              date,
              time_slot,
              session_period,
              teacher:teacher_id (
                name
              )
            )
          `)
          .eq('id', session.reservation_id)
          .single()

        // 문제 정보 조회
        const { data: problem } = await supabase
          .from('problems')
          .select('title')
          .eq('id', session.problem_id)
          .single()

        // 점수 정보 조회
        const { data: score } = await supabase
          .from('scores')
          .select('total_score')
          .eq('session_id', session.id)
          .single()

        return {
          id: session.id,
          date: (reservation?.slot as any)?.date || null,
          timeSlot: (reservation?.slot as any)?.time_slot || null,
          sessionPeriod: (reservation?.slot as any)?.session_period || null,
          teacherName: (reservation?.slot as any)?.teacher?.name || null,
          problemTitle: problem?.title || '문제 제목',
          finalScore: score?.total_score || 0,
          completedAt: session.completed_at
        }
      })
    )

    const formattedSessions = sessionData

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