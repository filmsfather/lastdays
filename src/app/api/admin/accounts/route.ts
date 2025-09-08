import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'
import { getCurrentUser } from '@/lib/auth'

// 관리자 전용 - 모든 계정 조회
export async function GET(req: NextRequest) {
  try {
    // 관리자 권한 확인
    const user = await getCurrentUser()
    if (!user || user.role !== 'admin') {
      return NextResponse.json(
        { error: '접근 권한이 없습니다.' },
        { status: 403 }
      )
    }
    const { data: accounts, error } = await supabase
      .from('accounts')
      .select('*')
      .order('created_at', { ascending: false })

    if (error) {
      return NextResponse.json(
        { error: '계정 조회 중 오류가 발생했습니다.' },
        { status: 500 }
      )
    }

    return NextResponse.json({
      success: true,
      accounts
    })
  } catch (error) {
    console.error('Get accounts error:', error)
    return NextResponse.json(
      { error: '서버 오류가 발생했습니다.' },
      { status: 500 }
    )
  }
}

// 관리자 전용 - 새 계정 생성
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
    const { name, className, role, pin } = body

    // 입력값 검증
    if (!name || !className || !role || !pin) {
      return NextResponse.json(
        { error: '모든 필드를 입력해주세요.' },
        { status: 400 }
      )
    }

    if (pin.length !== 4 || !/^\d{4}$/.test(pin)) {
      return NextResponse.json(
        { error: 'PIN은 4자리 숫자여야 합니다.' },
        { status: 400 }
      )
    }

    if (!['student', 'teacher', 'admin'].includes(role)) {
      return NextResponse.json(
        { error: '유효하지 않은 역할입니다.' },
        { status: 400 }
      )
    }

    // 중복 계정 확인
    const { data: existingAccount } = await supabase
      .from('accounts')
      .select('id')
      .eq('name', name)
      .eq('class_name', className)
      .single()

    if (existingAccount) {
      return NextResponse.json(
        { error: '이미 존재하는 계정입니다.' },
        { status: 409 }
      )
    }

    // 계정 생성
    const { data: newAccount, error } = await supabase
      .from('accounts')
      .insert([{
        name,
        class_name: className,
        role,
        pin
      }])
      .select()
      .single()

    if (error) {
      return NextResponse.json(
        { error: '계정 생성 중 오류가 발생했습니다.' },
        { status: 500 }
      )
    }


    return NextResponse.json({
      success: true,
      account: newAccount
    })
  } catch (error) {
    console.error('Create account error:', error)
    return NextResponse.json(
      { error: '서버 오류가 발생했습니다.' },
      { status: 500 }
    )
  }
}

