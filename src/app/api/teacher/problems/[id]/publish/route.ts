import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'
import { getCurrentUser } from '@/lib/auth'

// 교사 전용 - 문제 공개
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
      .select('id, status, title, content, created_by')
      .eq('id', problemId)
      .eq('created_by', user.id)
      .single()

    if (checkError || !existingProblem) {
      return NextResponse.json(
        { error: '문제를 찾을 수 없거나 공개 권한이 없습니다.' },
        { status: 404 }
      )
    }

    // 이미 공개된 문제인지 확인
    if (existingProblem.status === 'published') {
      return NextResponse.json(
        { error: '이미 공개된 문제입니다.' },
        { status: 400 }
      )
    }

    // 아카이브된 문제는 공개할 수 없음
    if (existingProblem.status === 'archived') {
      return NextResponse.json(
        { error: '아카이브된 문제는 공개할 수 없습니다.' },
        { status: 400 }
      )
    }

    // 필수 필드 검증
    if (!existingProblem.title || !existingProblem.content) {
      return NextResponse.json(
        { error: '제목과 내용이 모두 필요합니다.' },
        { status: 400 }
      )
    }

    const body = await req.json()
    const { scheduled_publish_at } = body

    // 문제 공개 (상태를 published로 변경)
    const updateData: any = {
      status: 'published',
      updated_at: new Date().toISOString()
    }

    // 예약 공개 시간이 있으면 설정
    if (scheduled_publish_at) {
      const publishDate = new Date(scheduled_publish_at)
      if (publishDate <= new Date()) {
        return NextResponse.json(
          { error: '예약 공개 시간은 현재 시간보다 이후여야 합니다.' },
          { status: 400 }
        )
      }
      updateData.scheduled_publish_at = publishDate.toISOString()
    }

    const { data: publishedProblem, error } = await supabase
      .from('problems')
      .update(updateData)
      .eq('id', problemId)
      .eq('created_by', user.id)
      .select()
      .single()

    if (error) {
      console.error('Database error:', error)
      return NextResponse.json(
        { error: '문제 공개 중 오류가 발생했습니다.' },
        { status: 500 }
      )
    }

    // 로그 기록 (향후 audit log 테이블 추가 시 사용)
    console.log(`Problem ${problemId} published by teacher ${user.id} (${user.name})`)

    return NextResponse.json({
      success: true,
      problem: publishedProblem,
      message: '문제가 공개되었습니다.'
    })
  } catch (error) {
    console.error('Publish problem error:', error)
    return NextResponse.json(
      { error: '서버 오류가 발생했습니다.' },
      { status: 500 }
    )
  }
}