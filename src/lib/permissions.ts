import { User } from '@/lib/auth'

// 역할 정의
export const ROLES = {
  STUDENT: 'student',
  TEACHER: 'teacher',
  ADMIN: 'admin'
} as const

export type Role = typeof ROLES[keyof typeof ROLES]

// 권한 정의
export const PERMISSIONS = {
  // 학생 권한
  VIEW_OWN_RESERVATIONS: 'view_own_reservations',
  CREATE_RESERVATION: 'create_reservation',
  CANCEL_OWN_RESERVATION: 'cancel_own_reservation',
  SELECT_PROBLEM: 'select_problem',
  VIEW_OWN_FEEDBACK: 'view_own_feedback',
  WRITE_REFLECTION: 'write_reflection',
  
  // 교사 권한
  VIEW_ALL_RESERVATIONS: 'view_all_reservations',
  VIEW_STUDENT_SCHEDULE: 'view_student_schedule',
  CREATE_PROBLEM: 'create_problem',
  EDIT_PROBLEM: 'edit_problem',
  PUBLISH_PROBLEM: 'publish_problem',
  ARCHIVE_PROBLEM: 'archive_problem',
  GIVE_FEEDBACK: 'give_feedback',
  SCORE_SESSION: 'score_session',
  MANAGE_CHECKLIST: 'manage_checklist',
  VIEW_STUDENT_HISTORY: 'view_student_history',
  
  // 관리자 권한
  MANAGE_ACCOUNTS: 'manage_accounts',
  ISSUE_TICKETS: 'issue_tickets',
  MANAGE_RESERVATION_SLOTS: 'manage_reservation_slots',
  VIEW_ALL_STUDENTS: 'view_all_students',
  VIEW_SYSTEM_LOGS: 'view_system_logs',
  MANAGE_SYSTEM_SETTINGS: 'manage_system_settings'
} as const

export type Permission = typeof PERMISSIONS[keyof typeof PERMISSIONS]

// 역할별 권한 매핑
const ROLE_PERMISSIONS: Record<Role, Permission[]> = {
  [ROLES.STUDENT]: [
    PERMISSIONS.VIEW_OWN_RESERVATIONS,
    PERMISSIONS.CREATE_RESERVATION,
    PERMISSIONS.CANCEL_OWN_RESERVATION,
    PERMISSIONS.SELECT_PROBLEM,
    PERMISSIONS.VIEW_OWN_FEEDBACK,
    PERMISSIONS.WRITE_REFLECTION
  ],
  
  [ROLES.TEACHER]: [
    PERMISSIONS.VIEW_ALL_RESERVATIONS,
    PERMISSIONS.VIEW_STUDENT_SCHEDULE,
    PERMISSIONS.CREATE_PROBLEM,
    PERMISSIONS.EDIT_PROBLEM,
    PERMISSIONS.PUBLISH_PROBLEM,
    PERMISSIONS.ARCHIVE_PROBLEM,
    PERMISSIONS.GIVE_FEEDBACK,
    PERMISSIONS.SCORE_SESSION,
    PERMISSIONS.MANAGE_CHECKLIST,
    PERMISSIONS.VIEW_STUDENT_HISTORY
  ],
  
  [ROLES.ADMIN]: [
    // 관리자는 모든 권한을 가짐
    ...Object.values(PERMISSIONS)
  ]
}

// 사용자가 특정 권한을 가지고 있는지 확인
export function hasPermission(user: User | null, permission: Permission): boolean {
  if (!user) return false
  
  const userPermissions = ROLE_PERMISSIONS[user.role as Role] || []
  return userPermissions.includes(permission)
}

// 사용자가 특정 역할인지 확인
export function hasRole(user: User | null, role: Role | Role[]): boolean {
  if (!user) return false
  
  const roles = Array.isArray(role) ? role : [role]
  return roles.includes(user.role as Role)
}

// 학생 전용 권한 체크
export function isStudent(user: User | null): boolean {
  return hasRole(user, ROLES.STUDENT)
}

// 교사 전용 권한 체크
export function isTeacher(user: User | null): boolean {
  return hasRole(user, ROLES.TEACHER)
}

// 관리자 전용 권한 체크
export function isAdmin(user: User | null): boolean {
  return hasRole(user, ROLES.ADMIN)
}

// 교사 또는 관리자 권한 체크
export function isTeacherOrAdmin(user: User | null): boolean {
  return hasRole(user, [ROLES.TEACHER, ROLES.ADMIN])
}

// 자신의 데이터만 접근 가능한지 확인 (학생이 자신의 예약만 볼 수 있는 등)
export function canAccessOwnData(user: User | null, resourceOwnerId: number): boolean {
  if (!user) return false
  
  // 관리자와 교사는 모든 데이터에 접근 가능
  if (isTeacherOrAdmin(user)) return true
  
  // 학생은 자신의 데이터만 접근 가능
  return user.id === resourceOwnerId
}

// 권한 기반 UI 표시 제어
export function canRenderComponent(user: User | null, permission: Permission): boolean {
  return hasPermission(user, permission)
}

// 복합 권한 체크 (여러 권한 중 하나라도 있으면 true)
export function hasAnyPermission(user: User | null, permissions: Permission[]): boolean {
  if (!user) return false
  
  return permissions.some(permission => hasPermission(user, permission))
}

// 복합 권한 체크 (모든 권한을 가져야 true)
export function hasAllPermissions(user: User | null, permissions: Permission[]): boolean {
  if (!user) return false
  
  return permissions.every(permission => hasPermission(user, permission))
}

// 에러 메시지 생성
export function getPermissionErrorMessage(permission: Permission): string {
  const messages: Record<Permission, string> = {
    [PERMISSIONS.VIEW_OWN_RESERVATIONS]: '자신의 예약 내역을 볼 권한이 없습니다.',
    [PERMISSIONS.CREATE_RESERVATION]: '예약을 생성할 권한이 없습니다.',
    [PERMISSIONS.CANCEL_OWN_RESERVATION]: '자신의 예약을 취소할 권한이 없습니다.',
    [PERMISSIONS.SELECT_PROBLEM]: '문제를 선택할 권한이 없습니다.',
    [PERMISSIONS.VIEW_OWN_FEEDBACK]: '자신의 피드백을 볼 권한이 없습니다.',
    [PERMISSIONS.WRITE_REFLECTION]: '복기를 작성할 권한이 없습니다.',
    [PERMISSIONS.VIEW_ALL_RESERVATIONS]: '모든 예약을 볼 권한이 없습니다.',
    [PERMISSIONS.VIEW_STUDENT_SCHEDULE]: '학생 일정을 볼 권한이 없습니다.',
    [PERMISSIONS.CREATE_PROBLEM]: '문제를 생성할 권한이 없습니다.',
    [PERMISSIONS.EDIT_PROBLEM]: '문제를 수정할 권한이 없습니다.',
    [PERMISSIONS.PUBLISH_PROBLEM]: '문제를 공개할 권한이 없습니다.',
    [PERMISSIONS.ARCHIVE_PROBLEM]: '문제를 아카이브할 권한이 없습니다.',
    [PERMISSIONS.GIVE_FEEDBACK]: '피드백을 줄 권한이 없습니다.',
    [PERMISSIONS.SCORE_SESSION]: '채점할 권한이 없습니다.',
    [PERMISSIONS.MANAGE_CHECKLIST]: '체크리스트를 관리할 권한이 없습니다.',
    [PERMISSIONS.VIEW_STUDENT_HISTORY]: '학생 기록을 볼 권한이 없습니다.',
    [PERMISSIONS.MANAGE_ACCOUNTS]: '계정을 관리할 권한이 없습니다.',
    [PERMISSIONS.ISSUE_TICKETS]: '이용권을 발급할 권한이 없습니다.',
    [PERMISSIONS.MANAGE_RESERVATION_SLOTS]: '예약 슬롯을 관리할 권한이 없습니다.',
    [PERMISSIONS.VIEW_ALL_STUDENTS]: '모든 학생을 볼 권한이 없습니다.',
    [PERMISSIONS.VIEW_SYSTEM_LOGS]: '시스템 로그를 볼 권한이 없습니다.',
    [PERMISSIONS.MANAGE_SYSTEM_SETTINGS]: '시스템 설정을 관리할 권한이 없습니다.'
  }
  
  return messages[permission] || '해당 작업을 수행할 권한이 없습니다.'
}