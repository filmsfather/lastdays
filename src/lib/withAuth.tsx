'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { User } from '@/lib/auth'

interface AuthState {
  user: User | null
  loading: boolean
  error: string | null
}

// 클라이언트 사이드에서 인증 상태 확인 훅
export function useAuth() {
  const [authState, setAuthState] = useState<AuthState>({
    user: null,
    loading: true,
    error: null
  })

  useEffect(() => {
    async function checkAuth() {
      try {
        const response = await fetch('/api/auth/me', {
          method: 'GET',
          credentials: 'include'
        })

        if (response.ok) {
          const data = await response.json()
          setAuthState({
            user: data.user,
            loading: false,
            error: null
          })
        } else {
          setAuthState({
            user: null,
            loading: false,
            error: '인증되지 않았습니다.'
          })
        }
      } catch (error) {
        setAuthState({
          user: null,
          loading: false,
          error: '인증 확인 중 오류가 발생했습니다.'
        })
      }
    }

    checkAuth()
  }, [])

  return authState
}

// 페이지 보호 HOC
export function withAuthPage<P extends object>(
  Component: React.ComponentType<P>,
  options?: {
    roles?: string[]
    redirectTo?: string
  }
) {
  return function AuthenticatedComponent(props: P) {
    const { user, loading, error } = useAuth()
    const router = useRouter()

    useEffect(() => {
      if (!loading) {
        if (!user) {
          // 인증되지 않은 사용자는 로그인 페이지로 리다이렉트
          router.push(options?.redirectTo || '/login')
          return
        }

        if (options?.roles && !options.roles.includes(user.role)) {
          // 권한이 없는 사용자는 접근 거부 페이지로 리다이렉트
          router.push('/access-denied')
          return
        }
      }
    }, [user, loading, router])

    if (loading) {
      return (
        <div className="flex min-h-screen items-center justify-center">
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
            <p className="text-gray-600">로딩 중...</p>
          </div>
        </div>
      )
    }

    if (error || !user) {
      return (
        <div className="flex min-h-screen items-center justify-center">
          <div className="text-center">
            <p className="text-red-600 mb-4">{error || '인증이 필요합니다.'}</p>
            <button 
              onClick={() => router.push('/login')}
              className="bg-blue-500 hover:bg-blue-600 text-white px-4 py-2 rounded"
            >
              로그인하기
            </button>
          </div>
        </div>
      )
    }

    if (options?.roles && !options.roles.includes(user.role)) {
      return (
        <div className="flex min-h-screen items-center justify-center">
          <div className="text-center">
            <p className="text-red-600 mb-4">접근 권한이 없습니다.</p>
            <button 
              onClick={() => router.push('/')}
              className="bg-gray-500 hover:bg-gray-600 text-white px-4 py-2 rounded"
            >
              홈으로 돌아가기
            </button>
          </div>
        </div>
      )
    }

    return <Component {...props} />
  }
}

// 특정 역할 전용 HOC들
export const withStudentPage = <P extends object>(Component: React.ComponentType<P>) =>
  withAuthPage(Component, { roles: ['student'] })

export const withTeacherPage = <P extends object>(Component: React.ComponentType<P>) =>
  withAuthPage(Component, { roles: ['teacher'] })

export const withAdminPage = <P extends object>(Component: React.ComponentType<P>) =>
  withAuthPage(Component, { roles: ['admin'] })

// 기본 export로 withAuth 추가
export const withAuth = withAuthPage

export const withTeacherOrAdminPage = <P extends object>(Component: React.ComponentType<P>) =>
  withAuthPage(Component, { roles: ['teacher', 'admin'] })