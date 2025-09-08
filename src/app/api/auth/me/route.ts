import { NextRequest, NextResponse } from 'next/server'
import { getCurrentUser } from '@/lib/auth'

// 현재 로그인한 사용자 정보 조회 API
export async function GET(req: NextRequest) {
  try {
    console.log('Auth ME API called')
    
    const user = await getCurrentUser()
    console.log('getCurrentUser result:', user ? { id: user.id, role: user.role } : 'null')

    if (!user) {
      console.log('No user found, returning 401')
      return NextResponse.json(
        { error: '인증이 필요합니다.' },
        { status: 401 }
      )
    }

    console.log('User found, returning success')
    return NextResponse.json({
      success: true,
      user
    })
  } catch (error) {
    console.error('Get current user error:', error)
    return NextResponse.json(
      { error: '사용자 정보 조회 중 오류가 발생했습니다.' },
      { status: 500 }
    )
  }
}