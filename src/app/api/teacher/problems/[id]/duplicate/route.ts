import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'
import { getCurrentUser } from '@/lib/auth'

// 교사 전용 - 문제 복제
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

    const body = await req.json()
    const { title: customTitle } = body // 사용자가 지정한 제목 (선택사항)

    // 원본 문제 조회 (본인이 생성한 문제만 복제 가능)
    const { data: originalProblem, error: fetchError } = await supabase
      .from('problems')
      .select('*')
      .eq('id', problemId)
      .eq('created_by', user.id)
      .single()

    if (fetchError || !originalProblem) {
      return NextResponse.json(
        { error: '문제를 찾을 수 없거나 복제 권한이 없습니다.' },
        { status: 404 }
      )
    }

    // 복제본 제목 생성
    const duplicateTitle = customTitle || `${originalProblem.title} (복사본)`

    // 복제본 생성 데이터 준비
    const duplicateData = {
      title: duplicateTitle,
      content: originalProblem.content,
      difficulty_level: originalProblem.difficulty_level,
      subject_area: originalProblem.subject_area,
      status: 'draft', // 복제본은 항상 초안 상태로 시작
      preview_lead_time: originalProblem.preview_lead_time,
      created_by: user.id, // 현재 사용자가 소유자
      // scheduled_publish_at은 복사하지 않음 (수동으로 설정해야 함)
    }

    // 문제 복제 실행
    const { data: duplicatedProblem, error: createError } = await supabase
      .from('problems')
      .insert([duplicateData])
      .select()
      .single()

    if (createError) {
      console.error('Database error:', createError)
      return NextResponse.json(
        { error: '문제 복제 중 오류가 발생했습니다.' },
        { status: 500 }
      )
    }

    // 성공 로그
    console.log(`Problem ${problemId} duplicated as ${duplicatedProblem.id} by teacher ${user.id} (${user.name})`)

    // 감사 로그 기록
    console.log(`AUDIT: Problem duplication - Original: ${problemId}, Duplicate: ${duplicatedProblem.id}, User: ${user.id}`)

    return NextResponse.json({
      success: true,
      originalProblem: {
        id: originalProblem.id,
        title: originalProblem.title
      },
      duplicatedProblem: {
        id: duplicatedProblem.id,
        title: duplicatedProblem.title,
        status: duplicatedProblem.status,
        created_at: duplicatedProblem.created_at
      },
      message: '문제가 성공적으로 복제되었습니다.'
    })

  } catch (error) {
    console.error('Duplicate problem error:', error)
    return NextResponse.json(
      { error: '서버 오류가 발생했습니다.' },
      { status: 500 }
    )
  }
}