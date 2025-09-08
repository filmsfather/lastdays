import { NextResponse } from 'next/server'
import { getCurrentUser } from '@/lib/auth'
import { supabase } from '@/lib/supabase'

// GET /api/student/sessions - 학생의 활성 세션 목록 조회
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

    // 2단계: 해당 예약들의 세션 조회
    const { data: sessions, error } = await supabase
      .from('sessions')
      .select(`
        id,
        status,
        started_at,
        created_at,
        reservation_id,
        problem_id
      `)
      .in('reservation_id', reservationIds)
      .in('status', ['active', 'feedback_pending', 'completed'])
      .order('created_at', { ascending: false })
      .limit(20)

    if (error) {
      console.error('Error fetching student sessions:', error)
      return NextResponse.json(
        { error: '세션 조회 중 오류가 발생했습니다.' },
        { status: 500 }
      )
    }

    if (!sessions || sessions.length === 0) {
      return NextResponse.json({
        success: true,
        sessions: []
      })
    }

    // 2.5단계: 만료된 세션들을 자동으로 completed로 업데이트
    const now = new Date()
    const expiredSessionIds: number[] = []
    
    for (const session of sessions) {
      if (session.status === 'active') {
        // 예약 정보와 문제 정보를 가져와서 종료 시간 계산
        const { data: reservation } = await supabase
          .from('reservations')
          .select(`
            slot:slot_id (
              date,
              session_period,
              teacher:teacher_id (id)
            )
          `)
          .eq('id', session.reservation_id)
          .single()

        const { data: problem } = await supabase
          .from('problems')
          .select('limit_minutes')
          .eq('id', session.problem_id)
          .single()

        if (reservation?.slot && problem) {
          // 큐 위치 계산을 위한 같은 슬롯의 예약들 조회
          const { data: queueData } = await supabase
            .from('reservations')
            .select(`
              id, 
              created_at,
              slot:slot_id (
                date,
                session_period,
                teacher:teacher_id (id)
              )
            `)
            .eq('slot.date', (reservation.slot as any).date)
            .eq('slot.session_period', (reservation.slot as any).session_period)
            .eq('slot.teacher_id', (reservation.slot as any).teacher.id)
            .order('created_at', { ascending: true })

          const queuePosition = (queueData?.findIndex(r => r.id === session.reservation_id) ?? -1) + 1 || 1
          
          // 스케줄링 계산
          const blockStart = (reservation.slot as any).session_period === 'AM' ? 10 : 16
          const scheduledStartAt = new Date((reservation.slot as any).date)
          scheduledStartAt.setHours(blockStart, 0, 0, 0)
          scheduledStartAt.setMinutes(scheduledStartAt.getMinutes() + (queuePosition - 1) * 10)
          
          const sessionEndTime = new Date(scheduledStartAt.getTime() + problem.limit_minutes * 60000)
          
          if (now >= sessionEndTime) {
            expiredSessionIds.push(session.id)
          }
        }
      }
    }

    // 만료된 세션들을 completed로 업데이트
    if (expiredSessionIds.length > 0) {
      await supabase
        .from('sessions')
        .update({ status: 'completed', completed_at: now.toISOString() })
        .in('id', expiredSessionIds)
    }

    // 업데이트 후 다시 조회 (completed 상태인 것들 제외)
    const { data: activeSessions, error: activeError } = await supabase
      .from('sessions')
      .select(`
        id,
        status,
        started_at,
        created_at,
        reservation_id,
        problem_id
      `)
      .in('reservation_id', reservationIds)
      .eq('status', 'active') // 이제 active만 조회
      .order('created_at', { ascending: false })
      .limit(20)

    if (activeError) {
      console.error('Error fetching active sessions:', activeError)
      return NextResponse.json(
        { error: '활성 세션 조회 중 오류가 발생했습니다.' },
        { status: 500 }
      )
    }

    if (!activeSessions || activeSessions.length === 0) {
      return NextResponse.json({
        success: true,
        sessions: []
      })
    }

    // 3단계: 각 활성 세션의 관련 데이터 조회
    const sessionData = await Promise.all(
      activeSessions.map(async (session: any) => {
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
                name,
                class_name
              )
            )
          `)
          .eq('id', session.reservation_id)
          .single()

        // 점수 정보 조회
        const { data: score } = await supabase
          .from('scores')
          .select('practical_skills, major_knowledge, major_suitability, attitude')
          .eq('session_id', session.id)
          .single()

        // 피드백 정보 조회
        const { data: feedback } = await supabase
          .from('feedbacks')
          .select('id')
          .eq('session_id', session.id)
          .single()

        // 복기 정보 조회
        const { data: reflection } = await supabase
          .from('student_reflections')
          .select('id')
          .eq('session_id', session.id)
          .single()

        // 문제 정보 조회
        const { data: problem } = await supabase
          .from('problems')
          .select('title, limit_minutes')
          .eq('id', session.problem_id)
          .single()

        return {
          id: session.id,
          status: session.status,
          date: (reservation?.slot as any)?.date || null,
          timeSlot: (reservation?.slot as any)?.time_slot || null,
          sessionPeriod: (reservation?.slot as any)?.session_period || null,
          teacherName: (reservation?.slot as any)?.teacher?.name || null,
          teacherClass: (reservation?.slot as any)?.teacher?.class_name || null,
          problemTitle: problem?.title || '문제 제목',
          limitMinutes: problem?.limit_minutes || 60,
          hasScore: !!score,
          finalScore: score ? 'complete' : 'incomplete',
          hasFeedback: !!feedback,
          hasReflection: !!reflection,
          createdAt: session.created_at,
          startedAt: session.started_at
        }
      })
    )

    const formattedSessions = sessionData

    return NextResponse.json({
      success: true,
      sessions: formattedSessions
    })

  } catch (error) {
    console.error('Get student sessions error:', error)
    return NextResponse.json(
      { error: '서버 오류가 발생했습니다.' },
      { status: 500 }
    )
  }
}