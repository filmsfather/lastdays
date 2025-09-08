import { NextRequest, NextResponse } from 'next/server'
import { getCurrentUser } from '@/lib/auth'
import { 
  triggerSchedulerManually, 
  getSchedulerStatus,
  ScheduleResult 
} from '@/lib/problemScheduler'

// 관리자 전용 - 스케줄러 상태 조회
export async function GET(req: NextRequest) {
  try {
    const user = await getCurrentUser()
    if (!user || user.role !== 'admin') {
      return NextResponse.json(
        { error: '관리자 권한이 필요합니다.' },
        { status: 403 }
      )
    }

    const status = await getSchedulerStatus()
    
    return NextResponse.json({
      success: true,
      status
    })
  } catch (error) {
    console.error('Get scheduler status error:', error)
    return NextResponse.json(
      { error: '스케줄러 상태 조회 중 오류가 발생했습니다.' },
      { status: 500 }
    )
  }
}

// 관리자 전용 - 스케줄러 수동 실행
export async function POST(req: NextRequest) {
  try {
    const user = await getCurrentUser()
    if (!user || user.role !== 'admin') {
      return NextResponse.json(
        { error: '관리자 권한이 필요합니다.' },
        { status: 403 }
      )
    }

    console.log(`Manual scheduler triggered by admin ${user.id} (${user.name})`)
    
    const result: ScheduleResult = await triggerSchedulerManually()
    
    // 실행 결과 로그
    console.log(`AUDIT: Manual scheduler execution by admin ${user.id}:`, {
      processedCount: result.processedCount,
      publishedCount: result.publishedProblems.length,
      errorCount: result.errors.length,
      executionTime: result.executionTime
    })

    return NextResponse.json({
      success: true,
      result: {
        processedCount: result.processedCount,
        publishedCount: result.publishedProblems.length,
        publishedProblems: result.publishedProblems,
        errorCount: result.errors.length,
        errors: result.errors,
        executionTimeMs: result.executionTime
      },
      message: `스케줄러가 실행되었습니다. ${result.publishedProblems.length}개 문제가 공개되었습니다.`
    })
  } catch (error) {
    console.error('Manual scheduler trigger error:', error)
    return NextResponse.json(
      { error: '스케줄러 실행 중 오류가 발생했습니다.' },
      { status: 500 }
    )
  }
}