import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'
import { getCurrentUser } from '@/lib/auth'
import { 
  calculateProblemSchedule, 
  getBlockStartTime, 
  formatTimeRemaining 
} from '@/lib/problemScheduling'

// 학생 전용 - 문제 사전열람 가능 여부 확인
export async function GET(
  req: NextRequest, 
  { params }: { params: Promise<{ problemId: string }> }
) {
  try {
    const user = await getCurrentUser()
    if (!user || user.role !== 'student') {
      return NextResponse.json(
        { error: '학생 권한이 필요합니다.' },
        { status: 403 }
      )
    }

    const { problemId: problemIdParam } = await params
    const problemId = parseInt(problemIdParam)
    if (isNaN(problemId)) {
      return NextResponse.json(
        { error: '유효하지 않은 문제 ID입니다.' },
        { status: 400 }
      )
    }

    const url = new URL(req.url)
    const reservationId = url.searchParams.get('reservationId')
    
    if (!reservationId) {
      return NextResponse.json(
        { error: '예약 ID가 필요합니다.' },
        { status: 400 }
      )
    }

    const reservationIdNum = parseInt(reservationId)
    if (isNaN(reservationIdNum)) {
      return NextResponse.json(
        { error: '유효하지 않은 예약 ID입니다.' },
        { status: 400 }
      )
    }

    // 1. 예약 정보 조회 (학생 소유권 확인 포함)
    const { data: reservation, error: reservationError } = await supabase
      .from('reservations')
      .select(`
        id,
        student_id,
        status,
        reservation_slots!inner(
          id,
          date,
          time_slot,
          session_period,
          teacher_id
        )
      `)
      .eq('id', reservationIdNum)
      .eq('student_id', user.id)
      .eq('status', 'active')
      .single()

    if (reservationError || !reservation) {
      return NextResponse.json(
        { error: '예약을 찾을 수 없거나 접근 권한이 없습니다.' },
        { status: 404 }
      )
    }

    // 2. 문제 정보 조회
    const { data: problem, error: problemError } = await supabase
      .from('problems')
      .select('id, title, preview_lead_time, status, scheduled_publish_at, created_by')
      .eq('id', problemId)
      .single()

    if (problemError || !problem) {
      return NextResponse.json(
        { error: '문제를 찾을 수 없습니다.' },
        { status: 404 }
      )
    }

    // 3. 문제가 공개 상태인지 확인
    if (problem.status !== 'published') {
      return NextResponse.json({
        canView: false,
        reason: '문제가 아직 공개되지 않았습니다.',
        schedule: null
      })
    }

    // 4. 같은 교사의 문제인지 확인
    const slot = reservation.reservation_slots as any
    if (problem.created_by !== slot.teacher_id) {
      return NextResponse.json(
        { error: '해당 예약의 교사가 작성한 문제가 아닙니다.' },
        { status: 400 }
      )
    }

    // 5. 해당 예약 슬롯의 대기열 위치 계산
    const { data: queueData, error: queueError } = await supabase
      .from('reservations')
      .select('id')
      .eq('slot_id', slot.id)
      .eq('status', 'active')
      .order('created_at', { ascending: true })

    if (queueError) {
      return NextResponse.json(
        { error: '대기열 정보 조회 중 오류가 발생했습니다.' },
        { status: 500 }
      )
    }

    // 현재 학생의 대기열 위치 찾기 (1부터 시작)
    const queuePosition = queueData.findIndex(r => r.id === reservationIdNum) + 1
    
    if (queuePosition === 0) {
      return NextResponse.json(
        { error: '대기열에서 예약을 찾을 수 없습니다.' },
        { status: 404 }
      )
    }

    // 6. 블록 시작 시간 계산
    const blockStartTime = getBlockStartTime(
      new Date(slot.date), 
      slot.block
    )

    // 7. 스케줄 계산
    const schedule = calculateProblemSchedule({
      blockStart: blockStartTime,
      queuePosition: queuePosition,
      previewLeadMinutes: problem.preview_lead_time || 0
    })

    // 8. 결과 반환
    const result = {
      canView: schedule.canShowProblem,
      reason: schedule.canShowProblem 
        ? '사전열람이 가능합니다.' 
        : `${formatTimeRemaining(schedule.timeUntilVisible)} 후에 사전열람이 가능합니다.`,
      schedule: {
        scheduledStartAt: schedule.scheduledStartAt.toISOString(),
        canShowProblem: schedule.canShowProblem,
        timeUntilVisible: schedule.timeUntilVisible,
        timeUntilStart: schedule.timeUntilStart,
        queuePosition: queuePosition,
        blockStartTime: blockStartTime.toISOString(),
        previewLeadTime: problem.preview_lead_time
      },
      problem: {
        id: problem.id,
        title: schedule.canShowProblem ? problem.title : '제목은 사전열람 시간에 공개됩니다.',
        status: problem.status
      }
    }

    return NextResponse.json(result)

  } catch (error) {
    console.error('Check problem availability error:', error)
    return NextResponse.json(
      { error: '서버 오류가 발생했습니다.' },
      { status: 500 }
    )
  }
}