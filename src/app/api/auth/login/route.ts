import { NextRequest, NextResponse } from 'next/server'
import { authenticateUser, createSession } from '@/lib/auth'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { name, pin } = body

    // 입력값 검증
    if (!name || !pin) {
      return NextResponse.json(
        { error: '이름과 PIN을 모두 입력해주세요.' },
        { status: 400 }
      )
    }

    if (pin.length !== 4 || !/^\d{4}$/.test(pin)) {
      return NextResponse.json(
        { error: 'PIN은 4자리 숫자여야 합니다.' },
        { status: 400 }
      )
    }

    // 사용자 인증 확인
    const user = await authenticateUser(name, pin)

    if (!user) {
      return NextResponse.json(
        { error: '이름 또는 PIN이 일치하지 않습니다.' },
        { status: 401 }
      )
    }

    // 세션 생성
    await createSession(user)

    // 응답 생성
    return NextResponse.json({
      success: true,
      user
    })

  } catch (error) {
    console.error('Login error:', error)
    return NextResponse.json(
      { error: '서버 오류가 발생했습니다.' },
      { status: 500 }
    )
  }
}