import { NextRequest, NextResponse } from 'next/server'
import { getCurrentUser } from '@/lib/auth'
import { supabase } from '@/lib/supabase'

// GET: 현재 요일별 예약 설정 조회
export async function GET() {
  try {
    const currentUser = await getCurrentUser()
    if (!currentUser || currentUser.role !== 'admin') {
      return NextResponse.json(
        { error: '관리자만 접근 가능합니다.' },
        { status: 403 }
      )
    }

    const { data: settings, error } = await supabase
      .from('reservation_day_settings')
      .select('*')
      .order('day_of_week')

    if (error) {
      console.error('Error fetching day settings:', error)
      return NextResponse.json(
        { error: '설정 조회 중 오류가 발생했습니다.' },
        { status: 500 }
      )
    }

    return NextResponse.json({
      success: true,
      settings: settings || []
    })

  } catch (error) {
    console.error('Get day settings error:', error)
    return NextResponse.json(
      { error: '서버 오류가 발생했습니다.' },
      { status: 500 }
    )
  }
}

// PUT: 특정 요일의 예약 설정 업데이트
export async function PUT(request: NextRequest) {
  try {
    const currentUser = await getCurrentUser()
    if (!currentUser || currentUser.role !== 'admin') {
      return NextResponse.json(
        { error: '관리자만 접근 가능합니다.' },
        { status: 403 }
      )
    }

    const body = await request.json()
    const { dayOfWeek, isEnabled } = body

    // 입력값 검증
    if (typeof dayOfWeek !== 'number' || dayOfWeek < 0 || dayOfWeek > 6) {
      return NextResponse.json(
        { error: '유효하지 않은 요일입니다. (0-6 범위)' },
        { status: 400 }
      )
    }

    if (typeof isEnabled !== 'boolean') {
      return NextResponse.json(
        { error: '유효하지 않은 설정값입니다.' },
        { status: 400 }
      )
    }

    const { data, error } = await supabase
      .from('reservation_day_settings')
      .update({ 
        is_enabled: isEnabled,
        updated_at: new Date().toISOString()
      })
      .eq('day_of_week', dayOfWeek)
      .select()
      .single()

    if (error) {
      console.error('Error updating day setting:', error)
      return NextResponse.json(
        { error: '설정 업데이트 중 오류가 발생했습니다.' },
        { status: 500 }
      )
    }

    const dayNames = ['일요일', '월요일', '화요일', '수요일', '목요일', '금요일', '토요일']
    
    return NextResponse.json({
      success: true,
      message: `${dayNames[dayOfWeek]} 예약 설정이 ${isEnabled ? '허용' : '제한'}으로 변경되었습니다.`,
      setting: data
    })

  } catch (error) {
    console.error('Update day settings error:', error)
    return NextResponse.json(
      { error: '서버 오류가 발생했습니다.' },
      { status: 500 }
    )
  }
}