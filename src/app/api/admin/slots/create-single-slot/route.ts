import { NextRequest, NextResponse } from 'next/server'
import { getCurrentUser } from '@/lib/auth'
import { supabase } from '@/lib/supabase'

// 단일 슬롯 생성 API
export async function POST(req: NextRequest) {
  try {
    const user = await getCurrentUser()

    if (!user || user.role !== 'admin') {
      return NextResponse.json(
        { error: '관리자만 접근할 수 있습니다.' },
        { status: 403 }
      )
    }

    const { date, timeSlot, sessionPeriod, teacherId } = await req.json()

    if (!date || !timeSlot || !sessionPeriod || !teacherId) {
      return NextResponse.json(
        { error: '필수 정보가 누락되었습니다.' },
        { status: 400 }
      )
    }

    // 이미 존재하는 슬롯인지 확인
    const { data: existingSlot, error: checkError } = await supabase
      .from('reservation_slots')
      .select('id')
      .eq('date', date)
      .eq('time_slot', timeSlot)
      .eq('teacher_id', teacherId)
      .single()

    if (checkError && checkError.code !== 'PGRST116') {
      console.error('기존 슬롯 확인 오류:', checkError)
      return NextResponse.json(
        { error: '슬롯 확인 중 오류가 발생했습니다.' },
        { status: 500 }
      )
    }

    if (existingSlot) {
      return NextResponse.json(
        { error: '이미 존재하는 시간 슬롯입니다.' },
        { status: 400 }
      )
    }

    // 새 슬롯 생성
    const { error: insertError } = await supabase
      .from('reservation_slots')
      .insert({
        date,
        time_slot: timeSlot,
        session_period: sessionPeriod,
        teacher_id: teacherId,
        max_capacity: 1,
        current_reservations: 0,
        is_available: true
      })

    if (insertError) {
      console.error('슬롯 생성 오류:', insertError)
      return NextResponse.json(
        { error: '슬롯 생성에 실패했습니다.' },
        { status: 500 }
      )
    }

    return NextResponse.json({
      success: true,
      message: '슬롯이 성공적으로 생성되었습니다.'
    })

  } catch (error) {
    console.error('Single slot creation error:', error)
    return NextResponse.json(
      { error: '슬롯 생성 중 오류가 발생했습니다.' },
      { status: 500 }
    )
  }
}