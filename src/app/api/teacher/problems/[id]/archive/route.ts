import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'
import { getCurrentUser } from '@/lib/auth'

// 교사 전용 - 문제 아카이브
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await getCurrentUser()
    if (!user || user.role !== 'teacher') {
      return NextResponse.json(
        { error: '교사 권한이 필요합니다.' },
        { status: 403 }
      )
    }

    const { id } = await params
    const problemId = parseInt(id)
    if (isNaN(problemId)) {
      return NextResponse.json(
        { error: '유효하지 않은 문제 ID입니다.' },
        { status: 400 }
      )
    }

    // 문제 소유권 및 상태 확인
    const { data: existingProblem, error: checkError } = await supabase
      .from('problems')
      .select('id, status, created_by')
      .eq('id', problemId)
      .eq('created_by', user.id)
      .single()

    if (checkError || !existingProblem) {
      return NextResponse.json(
        { error: '문제를 찾을 수 없거나 아카이브 권한이 없습니다.' },
        { status: 404 }
      )
    }

    // 이미 아카이브된 문제인지 확인
    if (existingProblem.status === 'archived') {
      return NextResponse.json(
        { error: '이미 아카이브된 문제입니다.' },
        { status: 400 }
      )
    }

    // 진행 중인 세션이 있는지 확인
    const { data: activeSessions, error: sessionError } = await supabase
      .from('sessions')
      .select('id')
      .eq('problem_id', problemId)
      .in('status', ['active', 'feedback_pending'])

    if (sessionError) {
      console.error('Session check error:', sessionError)
      return NextResponse.json(
        { error: '세션 상태 확인 중 오류가 발생했습니다.' },
        { status: 500 }
      )
    }

    // 활성 세션이 있으면 아카이브 불가
    if (activeSessions && activeSessions.length > 0) {
      return NextResponse.json(
        { error: '진행 중인 세션이 있는 문제는 아카이브할 수 없습니다.' },
        { status: 400 }
      )
    }

    // 문제 아카이브 (상태를 archived로 변경)
    const { data: archivedProblem, error } = await supabase
      .from('problems')
      .update({
        status: 'archived',
        updated_at: new Date().toISOString()
      })
      .eq('id', problemId)
      .eq('created_by', user.id)
      .select()
      .single()

    if (error) {
      console.error('Database error:', error)
      return NextResponse.json(
        { error: '문제 아카이브 중 오류가 발생했습니다.' },
        { status: 500 }
      )
    }

    // 로그 기록
    console.log(`Problem ${problemId} archived by teacher ${user.id} (${user.name})`)

    return NextResponse.json({
      success: true,
      problem: archivedProblem,
      message: '문제가 아카이브되었습니다.'
    })
  } catch (error) {
    console.error('Archive problem error:', error)
    return NextResponse.json(
      { error: '서버 오류가 발생했습니다.' },
      { status: 500 }
    )
  }
}