import { cookies } from 'next/headers'
import { supabase } from '@/lib/supabase'
import { randomBytes } from 'crypto'

export interface User {
  id: number
  name: string
  className: string
  role: 'student' | 'teacher' | 'admin'
}

export interface SessionData {
  user: User
  sessionToken: string
  expiresAt: Date
}

// 세션 토큰 생성
export function generateSessionToken(): string {
  return randomBytes(32).toString('hex')
}

// 세션 만료 시간 계산 (24시간)
export function getSessionExpiryDate(): Date {
  return new Date(Date.now() + 24 * 60 * 60 * 1000)
}

// 세션 생성 (쿠키에 저장)
export async function createSession(user: User): Promise<string> {
  const sessionToken = generateSessionToken()
  const expiresAt = getSessionExpiryDate()
  const cookieStore = await cookies()
  
  // 세션 토큰 쿠키 설정
  cookieStore.set('session', sessionToken, {
    httpOnly: true,
    secure: true,
    sameSite: 'lax',
    expires: expiresAt,
    path: '/'
  })

  // 사용자 정보 쿠키 설정
  const userInfo = {
    id: user.id,
    name: user.name,
    className: user.className,
    role: user.role
  }

  cookieStore.set('user', JSON.stringify(userInfo), {
    httpOnly: true,
    secure: true,
    sameSite: 'lax',
    expires: expiresAt,
    path: '/'
  })

  return sessionToken
}

// 현재 세션에서 사용자 정보 조회
export async function getCurrentUser(): Promise<User | null> {
  try {
    const cookieStore = await cookies()
    const sessionCookie = cookieStore.get('session')
    const userCookie = cookieStore.get('user')

    if (!sessionCookie || !userCookie) {
      return null
    }

    // 세션 토큰 검증 (실제로는 데이터베이스에서 확인해야 하지만 여기서는 쿠키 존재만 확인)
    const userInfo = JSON.parse(userCookie.value)
    
    // 사용자 정보 유효성 검증
    if (!userInfo.id || !userInfo.name || !userInfo.className || !userInfo.role) {
      return null
    }

    return {
      id: userInfo.id,
      name: userInfo.name,
      className: userInfo.className,
      role: userInfo.role
    }
  } catch (error) {
    console.error('Error getting current user:', error)
    return null
  }
}

// 세션 삭제
export async function deleteSession(): Promise<void> {
  const cookieStore = await cookies()

  // 세션 쿠키 삭제
  cookieStore.set('session', '', {
    httpOnly: true,
    secure: true,
    sameSite: 'lax',
    expires: new Date(0), // 즉시 만료
    path: '/'
  })

  // 사용자 정보 쿠키 삭제
  cookieStore.set('user', '', {
    httpOnly: true,
    secure: true,
    sameSite: 'lax',
    expires: new Date(0), // 즉시 만료
    path: '/'
  })
}

// 세션 검증 및 갱신
export async function validateAndRefreshSession(): Promise<User | null> {
  const user = await getCurrentUser()
  
  if (!user) {
    return null
  }

  // 세션 갱신 (새로운 만료시간 설정)
  await createSession(user)
  
  return user
}

// 사용자 인증 (데이터베이스에서 검증)
export async function authenticateUser(
  name: string, 
  pin: string
): Promise<User | null> {
  try {
    
    const { data: user, error } = await supabase
      .from('accounts')
      .select('*')
      .eq('name', name)
      .eq('pin', pin)
      .single()

    if (error || !user) {
      return null
    }

    const result = {
      id: user.id,
      name: user.name,
      className: user.class_name,
      role: user.role
    }

    return result
  } catch (error) {
    console.error('Authentication error:', error)
    return null
  }
}

// 세션 정리 (만료된 세션 정리 - 현재는 쿠키 기반이라 자동 정리됨)
export async function cleanupExpiredSessions(): Promise<void> {
  // 쿠키 기반 세션은 브라우저에서 자동으로 만료됨
  // 향후 데이터베이스 기반 세션으로 변경 시 구현
  // Session cleanup not needed for cookie-based sessions
}