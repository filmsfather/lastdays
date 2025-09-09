/**
 * 문제 스케줄링 및 사전열람 로직을 처리하는 유틸리티 함수들
 */

export interface ScheduleCalculationParams {
  blockStart: Date
  queuePosition: number
  previewLeadMinutes: number
}

export interface ScheduleResult {
  scheduledStartAt: Date
  canShowProblem: boolean
  timeUntilVisible: number // 밀리초 단위
  timeUntilStart: number // 밀리초 단위
}

/**
 * 문제의 예약 시작 시간을 계산
 * scheduledStartAt = blockStart + (queuePosition-1) × 10분
 */
export function calculateScheduledStartTime(
  blockStart: Date, 
  queuePosition: number
): Date {
  if (queuePosition < 1) {
    throw new Error('Queue position must be 1 or greater')
  }
  
  const delayMinutes = (queuePosition - 1) * 10
  const scheduledStartAt = new Date(blockStart.getTime() + delayMinutes * 60 * 1000)
  
  return scheduledStartAt
}

/**
 * 문제의 사전열람 가능 시점을 계산
 * canShowProblem = now >= scheduledStartAt - preview_lead_minutes
 */
export function canShowProblemNow(
  scheduledStartAt: Date,
  previewLeadMinutes: number,
  now: Date = new Date(new Date().toLocaleString('en-US', { timeZone: 'Asia/Seoul' }))
): boolean {
  const showTime = new Date(scheduledStartAt.getTime() - previewLeadMinutes * 60 * 1000)
  return now >= showTime
}

/**
 * 종합적인 스케줄 계산
 */
export function calculateProblemSchedule(params: ScheduleCalculationParams): ScheduleResult {
  const { blockStart, queuePosition, previewLeadMinutes } = params
  const now = new Date(new Date().toLocaleString('en-US', { timeZone: 'Asia/Seoul' }))
  
  // 1. 예약된 시작 시간 계산
  const scheduledStartAt = calculateScheduledStartTime(blockStart, queuePosition)
  
  // 2. 사전열람 가능 여부 확인
  const canShowProblem = canShowProblemNow(scheduledStartAt, previewLeadMinutes, now)
  
  // 3. 시간 차이 계산
  const showTime = new Date(scheduledStartAt.getTime() - previewLeadMinutes * 60 * 1000)
  const timeUntilVisible = Math.max(0, showTime.getTime() - now.getTime())
  const timeUntilStart = Math.max(0, scheduledStartAt.getTime() - now.getTime())
  
  return {
    scheduledStartAt,
    canShowProblem,
    timeUntilVisible,
    timeUntilStart
  }
}

/**
 * 예약 슬롯의 블록 시작 시간을 계산
 * 블록은 1-10이고, 각 블록은 특정 시간대에 해당
 */
export function getBlockStartTime(date: Date, block: number): Date {
  if (block < 1 || block > 10) {
    throw new Error('Block must be between 1 and 10')
  }
  
  // 블록별 시작 시간 (예: 1교시 9:00, 2교시 9:50, ...)
  // 실제 학교 시간표에 맞춰 조정 필요
  const blockStartHours = [
    9,   // 1교시: 09:00
    9,   // 2교시: 09:50  
    10,  // 3교시: 10:50
    11,  // 4교시: 11:40
    13,  // 5교시: 13:30
    14,  // 6교시: 14:20
    15,  // 7교시: 15:20
    16,  // 8교시: 16:10
    17,  // 9교시: 17:10
    18   // 10교시: 18:00
  ]
  
  const blockStartMinutes = [
    0,   // 1교시: 09:00
    50,  // 2교시: 09:50
    50,  // 3교시: 10:50  
    40,  // 4교시: 11:40
    30,  // 5교시: 13:30
    20,  // 6교시: 14:20
    20,  // 7교시: 15:20
    10,  // 8교시: 16:10
    10,  // 9교시: 17:10
    0    // 10교시: 18:00
  ]
  
  const blockStart = new Date(date)
  blockStart.setHours(blockStartHours[block - 1])
  blockStart.setMinutes(blockStartMinutes[block - 1])
  blockStart.setSeconds(0)
  blockStart.setMilliseconds(0)
  
  return blockStart
}

/**
 * 학생이 특정 예약에 대해 문제를 볼 수 있는지 확인
 */
export async function canStudentViewProblem(
  reservationId: number,
  problemId: number
): Promise<{ canView: boolean; reason?: string; schedule?: ScheduleResult }> {
  // 여기서는 데이터베이스 조회가 필요하므로 실제 구현에서는 supabase를 사용
  // 현재는 인터페이스만 정의
  
  return {
    canView: false,
    reason: 'Not implemented yet'
  }
}

/**
 * 시간을 읽기 쉬운 형태로 포맷
 */
export function formatTimeRemaining(milliseconds: number): string {
  if (milliseconds <= 0) return '지금'
  
  const minutes = Math.floor(milliseconds / (60 * 1000))
  const hours = Math.floor(minutes / 60)
  const days = Math.floor(hours / 24)
  
  if (days > 0) {
    const remainingHours = hours % 24
    return `${days}일 ${remainingHours}시간`
  } else if (hours > 0) {
    const remainingMinutes = minutes % 60
    return `${hours}시간 ${remainingMinutes}분`
  } else {
    return `${minutes}분`
  }
}

/**
 * 타임존을 고려한 정확한 시간 계산
 */
export function adjustForTimezone(date: Date, timezone: string = 'Asia/Seoul'): Date {
  // 한국 시간대 기준으로 조정
  try {
    return new Date(date.toLocaleString('en-US', { timeZone: timezone }))
  } catch (error) {
    console.warn('Timezone adjustment failed, using local time:', error)
    return date
  }
}

/**
 * 현재 한국 시간을 가져오는 유틸리티 함수
 */
export function getKoreanTime(): Date {
  return new Date(new Date().toLocaleString('en-US', { timeZone: 'Asia/Seoul' }))
}