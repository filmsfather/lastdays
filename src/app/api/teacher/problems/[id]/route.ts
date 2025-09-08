import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'
import { getCurrentUser } from '@/lib/auth'

// 교사 전용 - 특정 문제 조회
export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
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

    const { data: problem, error } = await supabase
      .from('problems')
      .select('*')
      .eq('id', problemId)
      .eq('created_by', user.id)
      .single()

    if (error || !problem) {
      return NextResponse.json(
        { error: '문제를 찾을 수 없습니다.' },
        { status: 404 }
      )
    }

    return NextResponse.json({
      success: true,
      problem
    })
  } catch (error) {
    console.error('Get problem error:', error)
    return NextResponse.json(
      { error: '서버 오류가 발생했습니다.' },
      { status: 500 }
    )
  }
}

// 교사 전용 - 문제 수정
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
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

    // 문제 소유권 확인
    const { data: existingProblem, error: checkError } = await supabase
      .from('problems')
      .select('id, status, created_by')
      .eq('id', problemId)
      .eq('created_by', user.id)
      .single()

    if (checkError || !existingProblem) {
      return NextResponse.json(
        { error: '문제를 찾을 수 없거나 수정 권한이 없습니다.' },
        { status: 404 }
      )
    }

    // 상태 변경은 별도 로직으로 처리 (content 수정은 published 상태에서 제한)
    const body = await req.json()
    const { status: newStatus } = body
    
    // 상태 변경만 하는 경우
    if (newStatus && Object.keys(body).length === 1) {
      // 상태 변경 허용
    } else if (existingProblem.status === 'published') {
      return NextResponse.json(
        { error: '게시된 문제의 내용은 수정할 수 없습니다. 상태 변경만 가능합니다.' },
        { status: 400 }
      )
    }

    const { 
      title, 
      content, 
      difficulty_level, 
      subject_area, 
      preview_lead_time,
      images,
      status
    } = body

    // 업데이트할 필드만 선택
    const updateData: any = { updated_at: new Date().toISOString() }
    
    if (status !== undefined) {
      if (!['draft', 'published', 'archived'].includes(status)) {
        return NextResponse.json(
          { error: '잘못된 상태값입니다.' },
          { status: 400 }
        )
      }
      updateData.status = status
    }
    
    if (title !== undefined) updateData.title = title
    if (content !== undefined) updateData.content = content
    if (difficulty_level !== undefined) {
      if (difficulty_level < 1 || difficulty_level > 5) {
        return NextResponse.json(
          { error: '난이도는 1-5 사이의 값이어야 합니다.' },
          { status: 400 }
        )
      }
      updateData.difficulty_level = difficulty_level
    }
    if (subject_area !== undefined) updateData.subject_area = subject_area
    if (preview_lead_time !== undefined) {
      if (preview_lead_time < 0) {
        return NextResponse.json(
          { error: '사전열람 시간은 0 이상이어야 합니다.' },
          { status: 400 }
        )
      }
      updateData.preview_lead_time = preview_lead_time
    }
    
    // 이미지 처리
    if (images !== undefined) {
      if (!Array.isArray(images)) {
        return NextResponse.json(
          { error: '이미지는 배열 형태여야 합니다.' },
          { status: 400 }
        )
      }
      
      // 각 이미지 객체 유효성 검증
      for (const image of images) {
        if (!image.url || typeof image.url !== 'string') {
          return NextResponse.json(
            { error: '이미지 URL이 올바르지 않습니다.' },
            { status: 400 }
          )
        }
        if (image.order && (!Number.isInteger(image.order) || image.order < 0)) {
          return NextResponse.json(
            { error: '이미지 순서는 0 이상의 정수여야 합니다.' },
            { status: 400 }
          )
        }
      }
      
      updateData.images = images
    }

    // 문제 수정
    const { data: updatedProblem, error } = await supabase
      .from('problems')
      .update(updateData)
      .eq('id', problemId)
      .eq('created_by', user.id)
      .select()
      .single()

    if (error) {
      console.error('Database error:', error)
      return NextResponse.json(
        { error: '문제 수정 중 오류가 발생했습니다.' },
        { status: 500 }
      )
    }

    return NextResponse.json({
      success: true,
      problem: updatedProblem
    })
  } catch (error) {
    console.error('Update problem error:', error)
    return NextResponse.json(
      { error: '서버 오류가 발생했습니다.' },
      { status: 500 }
    )
  }
}

// 교사 전용 - 문제 삭제
export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
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
        { error: '문제를 찾을 수 없거나 삭제 권한이 없습니다.' },
        { status: 404 }
      )
    }

    // 게시된 문제는 삭제 불가 (아카이브만 가능)
    if (existingProblem.status === 'published') {
      return NextResponse.json(
        { error: '게시된 문제는 삭제할 수 없습니다. 아카이브를 사용해주세요.' },
        { status: 400 }
      )
    }

    // 문제 삭제
    const { error } = await supabase
      .from('problems')
      .delete()
      .eq('id', problemId)
      .eq('created_by', user.id)

    if (error) {
      console.error('Database error:', error)
      return NextResponse.json(
        { error: '문제 삭제 중 오류가 발생했습니다.' },
        { status: 500 }
      )
    }

    return NextResponse.json({
      success: true,
      message: '문제가 삭제되었습니다.'
    })
  } catch (error) {
    console.error('Delete problem error:', error)
    return NextResponse.json(
      { error: '서버 오류가 발생했습니다.' },
      { status: 500 }
    )
  }
}