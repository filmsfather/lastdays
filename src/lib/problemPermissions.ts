/**
 * 문제 접근 권한 및 검증을 위한 유틸리티 함수들
 */

import { supabase } from '@/lib/supabase'
import { User } from '@/lib/auth'

export interface ProblemAccessResult {
  hasAccess: boolean
  reason?: string
  requiresElevation?: boolean
}

export interface ValidationResult {
  isValid: boolean
  errors: string[]
  warnings: string[]
}

/**
 * 교사의 문제 접근 권한 확인
 */
export async function checkTeacherProblemAccess(
  user: User,
  problemId: number,
  action: 'read' | 'write' | 'publish' | 'archive' | 'delete'
): Promise<ProblemAccessResult> {
  try {
    // 교사 권한 기본 확인
    if (user.role !== 'teacher') {
      return {
        hasAccess: false,
        reason: '교사 권한이 필요합니다.'
      }
    }

    // 문제 존재 및 소유권 확인
    const { data: problem, error } = await supabase
      .from('problems')
      .select('id, status, created_by, title')
      .eq('id', problemId)
      .single()

    if (error || !problem) {
      return {
        hasAccess: false,
        reason: '문제를 찾을 수 없습니다.'
      }
    }

    // 소유권 확인
    if (problem.created_by !== user.id) {
      return {
        hasAccess: false,
        reason: '본인이 생성한 문제에만 접근할 수 있습니다.'
      }
    }

    // 액션별 권한 검증
    switch (action) {
      case 'read':
        // 읽기는 소유자라면 항상 가능
        return { hasAccess: true }

      case 'write':
        // 공개된 문제는 수정 불가
        if (problem.status === 'published') {
          return {
            hasAccess: false,
            reason: '공개된 문제는 수정할 수 없습니다.'
          }
        }
        return { hasAccess: true }

      case 'publish':
        // 초안 상태의 문제만 공개 가능
        if (problem.status !== 'draft') {
          return {
            hasAccess: false,
            reason: '초안 상태의 문제만 공개할 수 있습니다.'
          }
        }
        return { hasAccess: true }

      case 'archive':
        // 공개된 문제만 아카이브 가능
        if (problem.status !== 'published') {
          return {
            hasAccess: false,
            reason: '공개된 문제만 아카이브할 수 있습니다.'
          }
        }
        
        // 진행 중인 세션이 있는지 확인
        const { data: activeSessions } = await supabase
          .from('sessions')
          .select('id')
          .eq('problem_id', problemId)
          .in('status', ['active', 'feedback_pending'])

        if (activeSessions && activeSessions.length > 0) {
          return {
            hasAccess: false,
            reason: '진행 중인 세션이 있는 문제는 아카이브할 수 없습니다.'
          }
        }
        return { hasAccess: true }

      case 'delete':
        // 초안과 아카이브된 문제만 삭제 가능
        if (problem.status === 'published') {
          return {
            hasAccess: false,
            reason: '공개된 문제는 삭제할 수 없습니다. 아카이브를 사용하세요.'
          }
        }
        return { hasAccess: true }

      default:
        return {
          hasAccess: false,
          reason: '알 수 없는 작업입니다.'
        }
    }

  } catch (error) {
    console.error('Permission check error:', error)
    return {
      hasAccess: false,
      reason: '권한 확인 중 오류가 발생했습니다.'
    }
  }
}

/**
 * 학생의 문제 접근 권한 확인
 */
export async function checkStudentProblemAccess(
  user: User,
  problemId: number,
  reservationId?: number
): Promise<ProblemAccessResult> {
  try {
    if (user.role !== 'student') {
      return {
        hasAccess: false,
        reason: '학생 권한이 필요합니다.'
      }
    }

    // 문제 존재 확인
    const { data: problem, error: problemError } = await supabase
      .from('problems')
      .select('id, status, created_by')
      .eq('id', problemId)
      .single()

    if (problemError || !problem) {
      return {
        hasAccess: false,
        reason: '문제를 찾을 수 없습니다.'
      }
    }

    // 공개된 문제만 접근 가능
    if (problem.status !== 'published') {
      return {
        hasAccess: false,
        reason: '공개되지 않은 문제입니다.'
      }
    }

    // 예약이 있는 경우 예약 검증
    if (reservationId) {
      const { data: reservation, error: reservationError } = await supabase
        .from('reservations')
        .select(`
          id,
          student_id,
          status,
          reservation_slots!inner(
            teacher_id
          )
        `)
        .eq('id', reservationId)
        .eq('student_id', user.id)
        .eq('status', 'active')
        .single()

      if (reservationError || !reservation) {
        return {
          hasAccess: false,
          reason: '유효한 예약이 없습니다.'
        }
      }

      // 예약의 교사와 문제 작성자가 일치하는지 확인
      const slot = reservation.reservation_slots as any
      if (slot.teacher_id !== problem.created_by) {
        return {
          hasAccess: false,
          reason: '예약한 교사의 문제가 아닙니다.'
        }
      }
    }

    return { hasAccess: true }

  } catch (error) {
    console.error('Student permission check error:', error)
    return {
      hasAccess: false,
      reason: '권한 확인 중 오류가 발생했습니다.'
    }
  }
}

/**
 * 관리자의 문제 접근 권한 확인
 */
export function checkAdminProblemAccess(user: User): ProblemAccessResult {
  if (user.role !== 'admin') {
    return {
      hasAccess: false,
      reason: '관리자 권한이 필요합니다.'
    }
  }

  // 관리자는 모든 문제에 접근 가능
  return { hasAccess: true }
}

/**
 * 문제 데이터 유효성 검증
 */
export function validateProblemData(problemData: any): ValidationResult {
  const errors: string[] = []
  const warnings: string[] = []

  // 필수 필드 검증
  if (!problemData.title || typeof problemData.title !== 'string' || problemData.title.trim().length === 0) {
    errors.push('제목은 필수입니다.')
  } else if (problemData.title.length > 200) {
    errors.push('제목은 200자를 초과할 수 없습니다.')
  }

  if (!problemData.content || typeof problemData.content !== 'string' || problemData.content.trim().length === 0) {
    errors.push('문제 내용은 필수입니다.')
  }

  // 난이도 검증
  if (problemData.difficulty_level !== undefined && problemData.difficulty_level !== null) {
    const difficultyLevel = Number(problemData.difficulty_level)
    if (isNaN(difficultyLevel) || difficultyLevel < 1 || difficultyLevel > 5) {
      errors.push('난이도는 1-5 사이의 숫자여야 합니다.')
    }
  }

  // 과목 영역 검증
  if (problemData.subject_area && problemData.subject_area.length > 100) {
    errors.push('과목 영역은 100자를 초과할 수 없습니다.')
  }

  // 사전열람 시간 검증
  if (problemData.preview_lead_time !== undefined && problemData.preview_lead_time !== null) {
    const previewLeadTime = Number(problemData.preview_lead_time)
    if (isNaN(previewLeadTime) || previewLeadTime < 0) {
      errors.push('사전열람 시간은 0 이상의 숫자여야 합니다.')
    } else if (previewLeadTime > 1440) { // 24시간
      warnings.push('사전열람 시간이 24시간을 초과합니다.')
    }
  }

  // 예약 공개 시간 검증
  if (problemData.scheduled_publish_at) {
    const scheduledDate = new Date(problemData.scheduled_publish_at)
    if (isNaN(scheduledDate.getTime())) {
      errors.push('유효하지 않은 예약 공개 시간입니다.')
    } else if (scheduledDate <= new Date()) {
      errors.push('예약 공개 시간은 현재 시간보다 이후여야 합니다.')
    }
  }

  return {
    isValid: errors.length === 0,
    errors,
    warnings
  }
}

/**
 * 일괄 권한 검증 (여러 문제에 대한 권한 확인)
 */
export async function checkBulkProblemAccess(
  user: User,
  problemIds: number[],
  action: 'read' | 'write' | 'publish' | 'archive' | 'delete'
): Promise<{ [problemId: number]: ProblemAccessResult }> {
  const results: { [problemId: number]: ProblemAccessResult } = {}

  for (const problemId of problemIds) {
    results[problemId] = await checkTeacherProblemAccess(user, problemId, action)
  }

  return results
}

/**
 * 권한 위반 로그 기록
 */
export function logPermissionViolation(
  user: User,
  problemId: number,
  action: string,
  reason: string,
  ip?: string
): void {
  const logData = {
    timestamp: new Date().toISOString(),
    userId: user.id,
    userName: user.name,
    userRole: user.role,
    problemId,
    action,
    reason,
    ip: ip || 'unknown',
    severity: 'warning'
  }

  // 실제 운영에서는 별도의 보안 로그 시스템에 저장
  console.warn('SECURITY: Permission violation detected', logData)

  // 향후 보안 이벤트 테이블에 저장하거나 외부 모니터링 시스템에 전송
}