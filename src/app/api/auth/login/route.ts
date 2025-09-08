import { NextRequest, NextResponse } from 'next/server'
import { authenticateUser, generateSessionToken, getSessionExpiryDate } from '@/lib/auth'

export async function POST(request: NextRequest) {
  try {
    console.log('Login API called')
    const body = await request.json()
    console.log('Request body:', body)
    const { name, pin } = body

    // 입력값 검증
    if (!name || !pin) {
      console.log('Validation failed: missing fields')
      return NextResponse.json(
        { error: '이름과 PIN을 모두 입력해주세요.' },
        { status: 400 }
      )
    }

    if (pin.length !== 4 || !/^\d{4}$/.test(pin)) {
      console.log('Validation failed: invalid PIN format')
      return NextResponse.json(
        { error: 'PIN은 4자리 숫자여야 합니다.' },
        { status: 400 }
      )
    }

    console.log('Calling authenticateUser...')
    // 사용자 인증 확인
    const user = await authenticateUser(name, pin)
    console.log('authenticateUser result:', user)

    if (!user) {
      return NextResponse.json(
        { error: '이름 또는 PIN이 일치하지 않습니다.' },
        { status: 401 }
      )
    }

    // 세션 생성
    const sessionToken = generateSessionToken()
    const expiresAt = getSessionExpiryDate()

    // 사용자 정보
    const userInfo = {
      id: user.id,
      name: user.name,
      className: user.className,
      role: user.role
    }

    // 응답 생성
    const response = NextResponse.json({
      success: true,
      user
    })

    // 쿠키 설정
    response.cookies.set('session', sessionToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      expires: expiresAt,
      path: '/'
    })

    response.cookies.set('user', JSON.stringify(userInfo), {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      expires: expiresAt,
      path: '/'
    })

    return response

  } catch (error) {
    console.error('Login error:', error)
    return NextResponse.json(
      { error: '서버 오류가 발생했습니다.' },
      { status: 500 }
    )
  }
}