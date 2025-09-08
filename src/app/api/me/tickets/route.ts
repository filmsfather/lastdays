import { NextRequest, NextResponse } from 'next/server'
import { getCurrentUser } from '@/lib/auth'
import { supabase } from '@/lib/supabase'

// 현재 로그인한 학생의 잔여 이용권 조회 API
export async function GET(req: NextRequest) {
  try {
    const user = await getCurrentUser()

    if (!user) {
      return NextResponse.json(
        { error: '인증이 필요합니다.' },
        { status: 401 }
      )
    }

    // 학생만 이용권을 조회할 수 있음
    if (user.role !== 'student') {
      return NextResponse.json(
        { error: '학생만 이용권을 조회할 수 있습니다.' },
        { status: 403 }
      )
    }

    // accounts 테이블에서 현재 학생의 이용권 정보 조회
    const { data: account, error } = await supabase
      .from('accounts')
      .select('current_tickets')
      .eq('id', user.id)
      .single()

    if (error) {
      console.error('Error fetching tickets:', error)
      return NextResponse.json(
        { error: '이용권 정보 조회 중 오류가 발생했습니다.' },
        { status: 500 }
      )
    }

    return NextResponse.json({
      success: true,
      remaining_tickets: account?.current_tickets || 0
    })
  } catch (error) {
    console.error('Get tickets error:', error)
    return NextResponse.json(
      { error: '이용권 조회 중 오류가 발생했습니다.' },
      { status: 500 }
    )
  }
}