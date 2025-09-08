'use client'

import { ReactNode } from 'react'
import { useAuth } from '@/lib/withAuth'
import { hasPermission, hasRole, Permission, Role } from '@/lib/permissions'

interface PermissionGateProps {
  children: ReactNode
  permission?: Permission
  role?: Role | Role[]
  fallback?: ReactNode
  requireAll?: boolean // 여러 권한이 있을 때 모두 필요한지 여부
}

// 권한 기반 컴포넌트 렌더링
export function PermissionGate({ 
  children, 
  permission, 
  role, 
  fallback = null,
  requireAll = false 
}: PermissionGateProps) {
  const { user } = useAuth()

  // 권한 확인
  if (permission && !hasPermission(user, permission)) {
    return <>{fallback}</>
  }

  // 역할 확인
  if (role && !hasRole(user, role)) {
    return <>{fallback}</>
  }

  return <>{children}</>
}

// 학생 전용 컴포넌트
export function StudentOnly({ children, fallback = null }: { children: ReactNode, fallback?: ReactNode }) {
  return (
    <PermissionGate role="student" fallback={fallback}>
      {children}
    </PermissionGate>
  )
}

// 교사 전용 컴포넌트
export function TeacherOnly({ children, fallback = null }: { children: ReactNode, fallback?: ReactNode }) {
  return (
    <PermissionGate role="teacher" fallback={fallback}>
      {children}
    </PermissionGate>
  )
}

// 관리자 전용 컴포넌트
export function AdminOnly({ children, fallback = null }: { children: ReactNode, fallback?: ReactNode }) {
  return (
    <PermissionGate role="admin" fallback={fallback}>
      {children}
    </PermissionGate>
  )
}

// 교사 또는 관리자 전용 컴포넌트
export function TeacherOrAdminOnly({ children, fallback = null }: { children: ReactNode, fallback?: ReactNode }) {
  return (
    <PermissionGate role={['teacher', 'admin']} fallback={fallback}>
      {children}
    </PermissionGate>
  )
}

// 권한 없음 메시지 컴포넌트
export function AccessDenied({ message = '접근 권한이 없습니다.' }: { message?: string }) {
  return (
    <div className="flex items-center justify-center min-h-[200px]">
      <div className="text-center">
        <div className="text-red-500 text-6xl mb-4">🚫</div>
        <h2 className="text-xl font-semibold text-gray-800 mb-2">접근 거부</h2>
        <p className="text-gray-600">{message}</p>
      </div>
    </div>
  )
}