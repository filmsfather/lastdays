import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'
import { getCurrentUser } from '@/lib/auth'

// 관리자 전용 - 모든 학생 이용권 일괄 초기화
export async function POST(req: NextRequest) {
  try {
    // 관리자 권한 확인
    const user = await getCurrentUser()
    if (!user || user.role !== 'admin') {
      return NextResponse.json(
        { error: '접근 권한이 없습니다.' },
        { status: 403 }
      )
    }

    // 초기화 전 현재 학생 수와 총 이용권 수 조회
    const { data: beforeStats, error: statsError } = await supabase
      .from('accounts')
      .select('id, name, class_name, current_tickets')
      .eq('role', 'student')

    if (statsError) {
      console.error('Stats query error:', statsError)
      return NextResponse.json(
        { error: '학생 정보 조회에 실패했습니다.' },
        { status: 500 }
      )
    }

    const totalStudents = beforeStats?.length || 0
    const totalTicketsBefore = beforeStats?.reduce((sum, student) => sum + student.current_tickets, 0) || 0

    if (totalStudents === 0) {
      return NextResponse.json(
        { error: '초기화할 학생이 없습니다.' },
        { status: 400 }
      )
    }

    // 모든 학생의 이용권을 0으로 초기화
    const { error: resetError } = await supabase
      .from('accounts')
      .update({ 
        current_tickets: 0,
        updated_at: new Date().toISOString()
      })
      .eq('role', 'student')

    if (resetError) {
      console.error('Ticket reset error:', resetError)
      return NextResponse.json(
        { error: '이용권 초기화 중 오류가 발생했습니다.' },
        { status: 500 }
      )
    }

    // 초기화 기록을 위한 티켓 로그 생성
    const resetLog = {
      student_id: null, // 전체 초기화이므로 null
      quantity: -totalTicketsBefore, // 음수로 기록하여 초기화임을 표시
      issued_by: user.id,
      issued_at: new Date().toISOString(),
      type: 'admin_reset',
      reason: `관리자 일괄 초기화 - ${totalStudents}명 학생, 총 ${totalTicketsBefore}장 → 0장`
    }

    const { error: logError } = await supabase
      .from('tickets')
      .insert([resetLog])

    if (logError) {
      console.error('Reset log error:', logError)
      // 로그 실패는 주요 기능에 영향을 주지 않으므로 계속 진행
    }

    return NextResponse.json({
      success: true,
      message: `모든 학생의 이용권이 초기화되었습니다.`,
      reset: {
        totalStudents,
        totalTicketsBefore,
        totalTicketsAfter: 0,
        resetBy: user.name,
        resetAt: new Date().toISOString()
      }
    })

  } catch (error) {
    console.error('Ticket reset error:', error)
    return NextResponse.json(
      { error: '서버 오류가 발생했습니다.' },
      { status: 500 }
    )
  }
}