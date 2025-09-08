import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'
import { getCurrentUser } from '@/lib/auth'

// 관리자 전용 - 주간 이용권 일괄 발급
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
    const { ticketCount = 10 } = await req.json()

    // 입력값 검증
    if (!Number.isInteger(ticketCount) || ticketCount <= 0) {
      return NextResponse.json(
        { error: '이용권 수량은 양의 정수여야 합니다.' },
        { status: 400 }
      )
    }

    // 모든 학생 계정 조회
    const { data: students, error: studentsError } = await supabase
      .from('accounts')
      .select('id, name, class_name')
      .eq('role', 'student')

    if (studentsError) {
      return NextResponse.json(
        { error: '학생 계정 조회 중 오류가 발생했습니다.' },
        { status: 500 }
      )
    }

    if (!students || students.length === 0) {
      return NextResponse.json(
        { error: '발급할 학생이 없습니다.' },
        { status: 400 }
      )
    }

    // 트랜잭션으로 이용권 일괄 발급
    const ticketInserts = students.map(student => ({
      student_id: student.id,
      quantity: ticketCount,
      issued_by: user.id,
      issued_at: new Date().toISOString(),
      type: 'weekly_bulk_issue'
    }))

    const { data: issuedTickets, error: insertError } = await supabase
      .from('tickets')
      .insert(ticketInserts)
      .select()

    if (insertError) {
      console.error('Weekly ticket issue error:', insertError)
      return NextResponse.json(
        { error: '이용권 발급 중 오류가 발생했습니다.' },
        { status: 500 }
      )
    }

    // 각 학생의 current_tickets 업데이트
    const updatePromises = students.map(student => 
      supabase.rpc('increment_tickets', {
        student_id: student.id,
        increment_amount: ticketCount
      })
    )

    const updateResults = await Promise.allSettled(updatePromises)
    const failedUpdates = updateResults.filter(result => result.status === 'rejected')

    if (failedUpdates.length > 0) {
      console.error('Some ticket updates failed:', failedUpdates)
      // 실패한 경우 롤백을 위해 발급된 티켓들 삭제
      await supabase
        .from('tickets')
        .delete()
        .in('id', issuedTickets?.map(t => t.id) || [])

      return NextResponse.json(
        { error: '일부 학생의 이용권 업데이트에 실패했습니다.' },
        { status: 500 }
      )
    }

    return NextResponse.json({
      success: true,
      message: `${students.length}명의 학생에게 각각 ${ticketCount}장의 이용권이 발급되었습니다. (최대 10장 제한 적용)`,
      issued: {
        studentCount: students.length,
        ticketCount: ticketCount,
        totalTickets: students.length * ticketCount,
        note: '개인당 최대 10장까지만 보유 가능'
      }
    })

  } catch (error) {
    console.error('Weekly ticket issue error:', error)
    return NextResponse.json(
      { error: '서버 오류가 발생했습니다.' },
      { status: 500 }
    )
  }
}

