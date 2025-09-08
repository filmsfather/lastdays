/**
 * 자동 문제 공개 스케줄러
 * 정기적으로 실행되어 예약된 문제들을 자동으로 공개하는 시스템
 */

import { supabase } from '@/lib/supabase'

export interface SchedulerConfig {
  intervalMinutes: number
  enabledEnvironments: string[]
  maxBatchSize: number
}

export interface ScheduleResult {
  processedCount: number
  publishedProblems: number[]
  errors: Array<{ problemId: number; error: string }>
  executionTime: number
}

const defaultConfig: SchedulerConfig = {
  intervalMinutes: 5, // 5분마다 실행
  enabledEnvironments: ['production', 'development'],
  maxBatchSize: 50 // 한 번에 처리할 최대 문제 수
}

/**
 * 자동 공개 대상 문제들을 조회
 */
async function getPendingPublishProblems(): Promise<any[]> {
  const now = new Date().toISOString()
  
  const { data: problems, error } = await supabase
    .from('problems')
    .select('id, title, scheduled_publish_at, created_by')
    .eq('status', 'draft')
    .not('scheduled_publish_at', 'is', null)
    .lte('scheduled_publish_at', now)
    .order('scheduled_publish_at', { ascending: true })
    .limit(defaultConfig.maxBatchSize)

  if (error) {
    throw new Error(`Failed to fetch pending problems: ${error.message}`)
  }

  return problems || []
}

/**
 * 개별 문제를 공개 상태로 변경
 */
async function publishProblem(problemId: number): Promise<void> {
  const { error } = await supabase
    .from('problems')
    .update({
      status: 'published',
      updated_at: new Date().toISOString()
    })
    .eq('id', problemId)
    .eq('status', 'draft') // 상태가 여전히 draft인 경우만 업데이트

  if (error) {
    throw new Error(`Failed to publish problem ${problemId}: ${error.message}`)
  }
}

/**
 * 스케줄러 실행
 */
export async function runScheduler(config: SchedulerConfig = defaultConfig): Promise<ScheduleResult> {
  const startTime = Date.now()
  const result: ScheduleResult = {
    processedCount: 0,
    publishedProblems: [],
    errors: [],
    executionTime: 0
  }

  try {
    console.log('Problem scheduler starting...')

    // 현재 환경이 활성화된 환경인지 확인
    const currentEnv = process.env.NODE_ENV || 'development'
    if (!config.enabledEnvironments.includes(currentEnv)) {
      console.log(`Scheduler skipped - environment ${currentEnv} not enabled`)
      return result
    }

    // 공개 대기 중인 문제들 조회
    const pendingProblems = await getPendingPublishProblems()
    result.processedCount = pendingProblems.length

    if (pendingProblems.length === 0) {
      console.log('No problems scheduled for publishing')
      return result
    }

    console.log(`Found ${pendingProblems.length} problems scheduled for publishing`)

    // 각 문제를 순차적으로 공개
    for (const problem of pendingProblems) {
      try {
        await publishProblem(problem.id)
        result.publishedProblems.push(problem.id)
        
        console.log(`Published problem ${problem.id}: "${problem.title}"`)
        
        // 감사 로그 기록 (향후 audit 테이블 추가 시 사용)
        console.log(`AUDIT: Problem ${problem.id} auto-published at ${new Date().toISOString()}`)
        
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error'
        result.errors.push({
          problemId: problem.id,
          error: errorMessage
        })
        
        console.error(`Failed to publish problem ${problem.id}:`, errorMessage)
      }
    }

    result.executionTime = Date.now() - startTime
    
    console.log(`Problem scheduler completed: ${result.publishedProblems.length} published, ${result.errors.length} errors, ${result.executionTime}ms`)

    return result

  } catch (error) {
    result.executionTime = Date.now() - startTime
    const errorMessage = error instanceof Error ? error.message : 'Unknown scheduler error'
    
    console.error('Problem scheduler failed:', errorMessage)
    
    // 전체 실행 실패를 오류로 기록
    result.errors.push({
      problemId: -1,
      error: errorMessage
    })

    return result
  }
}

/**
 * 스케줄러를 주기적으로 실행하는 함수
 * 실제 프로덕션에서는 cron job이나 서버리스 함수로 대체 필요
 */
export function startScheduler(config: SchedulerConfig = defaultConfig): NodeJS.Timeout {
  console.log(`Starting problem scheduler with ${config.intervalMinutes} minute intervals`)
  
  // 즉시 한 번 실행
  runScheduler(config)

  // 주기적 실행 설정
  const intervalId = setInterval(() => {
    runScheduler(config).catch(error => {
      console.error('Scheduled execution failed:', error)
    })
  }, config.intervalMinutes * 60 * 1000)

  return intervalId
}

/**
 * 스케줄러 중지
 */
export function stopScheduler(intervalId: NodeJS.Timeout): void {
  clearInterval(intervalId)
  console.log('Problem scheduler stopped')
}

/**
 * 스케줄러 상태 확인
 */
export async function getSchedulerStatus(): Promise<{
  pendingCount: number
  nextScheduledAt: string | null
  lastRunAt: string | null
}> {
  try {
    // 대기 중인 문제 수 조회
    const { count: pendingCount, error: countError } = await supabase
      .from('problems')
      .select('id', { count: 'exact', head: true })
      .eq('status', 'draft')
      .not('scheduled_publish_at', 'is', null)
      .lte('scheduled_publish_at', new Date().toISOString())

    if (countError) {
      throw new Error(`Failed to count pending problems: ${countError.message}`)
    }

    // 다음 예약된 문제의 공개 시간 조회
    const { data: nextProblem, error: nextError } = await supabase
      .from('problems')
      .select('scheduled_publish_at')
      .eq('status', 'draft')
      .not('scheduled_publish_at', 'is', null)
      .gt('scheduled_publish_at', new Date().toISOString())
      .order('scheduled_publish_at', { ascending: true })
      .limit(1)
      .single()

    if (nextError && nextError.code !== 'PGRST116') {
      throw new Error(`Failed to fetch next scheduled problem: ${nextError.message}`)
    }

    return {
      pendingCount: pendingCount || 0,
      nextScheduledAt: nextProblem?.scheduled_publish_at || null,
      lastRunAt: new Date().toISOString() // 실제로는 별도 상태 테이블에서 관리
    }

  } catch (error) {
    console.error('Failed to get scheduler status:', error)
    return {
      pendingCount: 0,
      nextScheduledAt: null,
      lastRunAt: null
    }
  }
}

/**
 * 수동으로 스케줄러를 한 번 실행하는 API용 함수
 */
export async function triggerSchedulerManually(): Promise<ScheduleResult> {
  console.log('Manual scheduler trigger requested')
  return await runScheduler()
}