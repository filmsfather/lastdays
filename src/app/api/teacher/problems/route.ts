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

    const { searchParams } = new URL(req.url)
    const availableDate = searchParams.get('date') // YYYY-MM-DD 형식
    const publishedOnly = searchParams.get('publishedOnly') === 'true' // 공개된 문제만 조회

    let query = supabase
      .from('problems')
      .select(`
        *,
        creator:accounts!created_by(name, class_name)
      `)
      .order('created_at', { ascending: false })

    // 공개된 문제만 조회 (문제 변경 시 사용)
    if (publishedOnly) {
      query = query.eq('status', 'published')
    }

    // 특정 날짜의 문제만 조회 (문제 변경 시 당일 활성화된 문제용)
    if (availableDate) {
      query = query.eq('available_date', availableDate)
    }

    const { data: problems, error } = await query

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
      available_date,
      is_public = false,
      preview_lead_time = 10,
      images = []
    } = body

    // 입력값 검증
    if (!title || !content) {
      return NextResponse.json(
        { error: '제목과 내용은 필수입니다.' },
        { status: 400 }
      )
    }

    if (!preview_lead_time || preview_lead_time < 1 || preview_lead_time > 240) {
      return NextResponse.json(
        { error: '사전열람 시간은 1-240분 사이의 값이어야 합니다.' },
        { status: 400 }
      )
    }

    if (!available_date) {
      return NextResponse.json(
        { error: '공개 날짜는 필수입니다.' },
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

    // 문제 생성 (is_public에 따라 상태 결정)
    const { data: newProblem, error } = await supabase
      .from('problems')
      .insert([{
        title,
        content,
        available_date,
        status: is_public ? 'published' : 'draft',
        preview_lead_time,
        limit_minutes: 60, // 임시로 기본값 추가 (DB 호환성)
        images: images || [],
        created_by: user.id
      }])
      .select()
      .single()

    if (error) {
      console.error('Database error:', error)
      console.error('Insert data:', {
        title,
        content,
        available_date,
        status: is_public ? 'published' : 'draft',
        preview_lead_time,
        limit_minutes: 60,
        images: images || [],
        created_by: user.id
      })
      return NextResponse.json(
        { error: `문제 생성 중 오류가 발생했습니다: ${error.message}` },
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