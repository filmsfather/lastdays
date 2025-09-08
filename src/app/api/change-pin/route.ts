import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'
import { getCurrentUser } from '@/lib/auth'

export async function POST(req: NextRequest) {
  try {
    const user = await getCurrentUser()
    if (!user) {
      return NextResponse.json(
        { error: '로그인이 필요합니다.' },
        { status: 401 }
      )
    }

    const body = await req.json()
    const { currentPin, newPin } = body

    // 입력값 검증
    if (!currentPin || !newPin) {
      return NextResponse.json(
        { error: '현재 PIN과 새 PIN을 모두 입력해주세요.' },
        { status: 400 }
      )
    }

    if (newPin.length !== 4 || !/^\d{4}$/.test(newPin)) {
      return NextResponse.json(
        { error: '새 PIN은 4자리 숫자여야 합니다.' },
        { status: 400 }
      )
    }

    // 데이터베이스에서 실제 사용자 정보 조회 (PIN 포함)
    const { data: dbUser, error: dbError } = await supabase
      .from('accounts')
      .select('pin')
      .eq('id', user.id)
      .single()

    if (dbError || !dbUser) {
      return NextResponse.json(
        { error: '사용자 정보를 찾을 수 없습니다.' },
        { status: 404 }
      )
    }

    // 현재 PIN 확인
    if (dbUser.pin !== currentPin) {
      return NextResponse.json(
        { error: '현재 PIN이 일치하지 않습니다.' },
        { status: 400 }
      )
    }

    // 현재 PIN과 새 PIN이 같은지 확인
    if (currentPin === newPin) {
      return NextResponse.json(
        { error: '새 PIN은 현재 PIN과 달라야 합니다.' },
        { status: 400 }
      )
    }

    // 중복 확인 (이름 + 새PIN 조합)
    const { data: existingAccount } = await supabase
      .from('accounts')
      .select('id')
      .eq('name', user.name)
      .eq('pin', newPin)
      .single()

    if (existingAccount) {
      return NextResponse.json(
        { error: '이미 동일한 이름과 PIN 번호를 사용하는 계정이 존재합니다.' },
        { status: 409 }
      )
    }

    // PIN 업데이트
    const { error: updateError } = await supabase
      .from('accounts')
      .update({ pin: newPin, updated_at: new Date().toISOString() })
      .eq('id', user.id)

    if (updateError) {
      console.error('PIN update error:', updateError)
      return NextResponse.json(
        { error: 'PIN 변경 중 오류가 발생했습니다.' },
        { status: 500 }
      )
    }

    return NextResponse.json({
      success: true,
      message: 'PIN이 성공적으로 변경되었습니다.'
    })
  } catch (error) {
    console.error('Change PIN error:', error)
    return NextResponse.json(
      { error: '서버 오류가 발생했습니다.' },
      { status: 500 }
    )
  }
}