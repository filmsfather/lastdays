import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'
import { getCurrentUser } from '@/lib/auth'

// 교사 전용 - 문제 목록 조회
export async function GET(req: NextRequest) {
  try {
    const user = await getCurrentUser()
    if (!user || user.role !== 'teacher') {
      return NextResponse.json(
        { error: '교사 권한이 필요합니다.' },
        { status: 403 }
      )
    }

    const { data: problems, error } = await supabase
      .from('problems')
      .select('*')
      .eq('created_by', user.id)
      .order('created_at', { ascending: false })

    if (error) {
      return NextResponse.json(
        { error: '문제 목록 조회 중 오류가 발생했습니다.' },
        { status: 500 }
      )
    }

    return NextResponse.json({
      success: true,
      problems
    })
  } catch (error) {
    console.error('Get problems error:', error)
    return NextResponse.json(
      { error: '서버 오류가 발생했습니다.' },
      { status: 500 }
    )
  }
}

// 교사 전용 - 문제 초안 생성
export async function POST(req: NextRequest) {
  try {
    const user = await getCurrentUser()
    if (!user || user.role !== 'teacher') {
      return NextResponse.json(
        { error: '교사 권한이 필요합니다.' },
        { status: 403 }
      )
    }

    const body = await req.json()
    const { 
      title, 
      content, 
      difficulty_level, 
      subject_area, 
      preview_lead_time = 24,
      images = []
    } = body

    // 입력값 검증
    if (!title || !content) {
      return NextResponse.json(
        { error: '제목과 내용은 필수입니다.' },
        { status: 400 }
      )
    }

    if (difficulty_level && (difficulty_level < 1 || difficulty_level > 5)) {
      return NextResponse.json(
        { error: '난이도는 1-5 사이의 값이어야 합니다.' },
        { status: 400 }
      )
    }

    if (preview_lead_time < 0) {
      return NextResponse.json(
        { error: '사전열람 시간은 0 이상이어야 합니다.' },
        { status: 400 }
      )
    }

    // 이미지 배열 유효성 검증
    if (images && !Array.isArray(images)) {
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

    // 문제 초안 생성 (상태는 draft, is_active는 false)
    const { data: newProblem, error } = await supabase
      .from('problems')
      .insert([{
        title,
        content,
        difficulty_level,
        subject_area,
        status: 'draft',
        preview_lead_time,
        images: images || [],
        created_by: user.id
      }])
      .select()
      .single()

    if (error) {
      console.error('Database error:', error)
      return NextResponse.json(
        { error: '문제 생성 중 오류가 발생했습니다.' },
        { status: 500 }
      )
    }

    return NextResponse.json({
      success: true,
      problem: newProblem
    })
  } catch (error) {
    console.error('Create problem error:', error)
    return NextResponse.json(
      { error: '서버 오류가 발생했습니다.' },
      { status: 500 }
    )
  }
}