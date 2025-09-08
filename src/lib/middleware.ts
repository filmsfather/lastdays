import { NextRequest, NextResponse } from 'next/server'
import { getCurrentUser, User } from '@/lib/auth'

export interface AuthenticatedRequest extends NextRequest {
  user?: User
}

// API 라우트용 인증 미들웨어 (오버로드)
export function withAuth(
  handler: (req: AuthenticatedRequest) => Promise<NextResponse>
): (req: NextRequest) => Promise<NextResponse>

export function withAuth<T>(
  handler: (req: AuthenticatedRequest, context: T) => Promise<NextResponse>
): (req: NextRequest, context: T) => Promise<NextResponse>

export function withAuth<T = any>(
  handler: (req: AuthenticatedRequest, context?: T) => Promise<NextResponse>
) {
  return async (req: NextRequest, context?: T): Promise<NextResponse> => {
    try {
      // 세션에서 사용자 정보 조회
      const user = await getCurrentUser()
      
      if (!user) {
        return NextResponse.json(
          { error: '인증이 필요합니다.' },
          { status: 401 }
        )
      }

      // 요청 객체에 사용자 정보 추가
      const authenticatedReq = req as AuthenticatedRequest
      authenticatedReq.user = user

      // 원래 핸들러 실행
      return await handler(authenticatedReq, context)
    } catch (error) {
      console.error('Authentication middleware error:', error)
      return NextResponse.json(
        { error: '인증 처리 중 오류가 발생했습니다.' },
        { status: 500 }
      )
    }
  }
}

// 특정 역할만 접근 가능한 API 라우트용 미들웨어
export function withRole(roles: string | string[]) {
  const allowedRoles = Array.isArray(roles) ? roles : [roles]
  
  // 오버로드 1: context가 없는 경우
  function roleWrapper(
    handler: (req: AuthenticatedRequest) => Promise<NextResponse>
  ): (req: NextRequest) => Promise<NextResponse>
  
  // 오버로드 2: context가 있는 경우
  function roleWrapper<T>(
    handler: (req: AuthenticatedRequest, context: T) => Promise<NextResponse>
  ): (req: NextRequest, context: T) => Promise<NextResponse>
  
  // 구현
  function roleWrapper<T = any>(
    handler: (req: AuthenticatedRequest, context?: T) => Promise<NextResponse>
  ) {
    return withAuth<T>(async (req: AuthenticatedRequest, context?: T) => {
      const user = req.user!
      
      if (!allowedRoles.includes(user.role)) {
        return NextResponse.json(
          { error: '접근 권한이 없습니다.' },
          { status: 403 }
        )
      }

      return await handler(req, context)
    })
  }
  
  return roleWrapper
}

// 학생 전용 미들웨어
export const withStudent = withRole('student')

// 교사 전용 미들웨어  
export const withTeacher = withRole('teacher')

// 관리자 전용 미들웨어
export const withAdmin = withRole('admin')

// 교사 또는 관리자 전용 미들웨어
export const withTeacherOrAdmin = withRole(['teacher', 'admin'])

// 현재 사용자 정보 반환 API 헬퍼
export async function getCurrentUserFromRequest(req: NextRequest): Promise<User | null> {
  try {
    return await getCurrentUser()
  } catch (error) {
    console.error('Error getting user from request:', error)
    return null
  }
}