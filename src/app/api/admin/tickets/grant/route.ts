import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'
import { getCurrentUser } from '@/lib/auth'

// 관리자 전용 - 개별 이용권 추가 발급
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
    const body = await req.json()
    const { studentId, ticketCount, reason } = body

    // 입력값 검증
    if (!studentId) {
      return NextResponse.json(
        { error: '학생 ID를 입력해주세요.' },
        { status: 400 }
      )
    }

    if (!Number.isInteger(ticketCount) || ticketCount <= 0) {
      return NextResponse.json(
        { error: '이용권 수량은 양의 정수여야 합니다.' },
        { status: 400 }
      )
    }

    // 학생 계정 존재 및 권한 확인
    const { data: student, error: studentError } = await supabase
      .from('accounts')
      .select('id, name, class_name, role')
      .eq('id', studentId)
      .single()

    if (studentError || !student) {
      return NextResponse.json(
        { error: '학생을 찾을 수 없습니다.' },
        { status: 404 }
      )
    }

    if (student.role !== 'student') {
      return NextResponse.json(
        { error: '학생 계정이 아닙니다.' },
        { status: 400 }
      )
    }

    // 트랜잭션으로 이용권 발급
    const { data: issuedTicket, error: insertError } = await supabase
      .from('tickets')
      .insert([{
        student_id: studentId,
        quantity: ticketCount,
        issued_by: user.id,
        issued_at: new Date().toISOString(),
        type: 'individual_grant',
        reason: reason || '관리자 개별 발급'
      }])
      .select()
      .single()

    if (insertError) {
      console.error('Individual ticket grant error:', insertError)
      return NextResponse.json(
        { error: '이용권 발급 중 오류가 발생했습니다.' },
        { status: 500 }
      )
    }

    // 학생의 current_tickets 업데이트
    const { error: updateError } = await supabase.rpc('increment_tickets', {
      student_id: studentId,
      increment_amount: ticketCount
    })

    if (updateError) {
      console.error('Ticket count update error:', updateError)
      // 실패한 경우 발급된 티켓 삭제 (롤백)
      await supabase
        .from('tickets')
        .delete()
        .eq('id', issuedTicket.id)

      return NextResponse.json(
        { error: '이용권 수량 업데이트에 실패했습니다.' },
        { status: 500 }
      )
    }

    // 업데이트된 학생 정보 조회
    const { data: updatedStudent, error: fetchError } = await supabase
      .from('accounts')
      .select('id, name, class_name, current_tickets')
      .eq('id', studentId)
      .single()

    return NextResponse.json({
      success: true,
      message: `${student.name}(${student.class_name})에게 ${ticketCount}장의 이용권이 발급되었습니다. (최대 10장 제한 적용)`,
      grant: {
        student: {
          id: student.id,
          name: student.name,
          className: student.class_name,
          currentTickets: updatedStudent?.current_tickets || 0,
          maxTickets: 10
        },
        grantedTickets: ticketCount,
        reason: reason || '관리자 개별 발급',
        note: '개인당 최대 10장까지만 보유 가능'
      }
    })

  } catch (error) {
    console.error('Individual ticket grant error:', error)
    return NextResponse.json(
      { error: '서버 오류가 발생했습니다.' },
      { status: 500 }
    )
  }
}

