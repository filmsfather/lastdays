import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'
import { getCurrentUser } from '@/lib/auth'

// 학생용 - 공개된 문제 목록 조회
export async function GET(req: NextRequest) {
  try {
    const user = await getCurrentUser()
    if (!user || user.role !== 'student') {
      return NextResponse.json(
        { error: '학생 권한이 필요합니다.' },
        { status: 403 }
      )
    }

    const { searchParams } = new URL(req.url)
    const availableDate = searchParams.get('date') // YYYY-MM-DD 형식

    let query = supabase
      .from('problems')
      .select(`
        id,
        title,
        limit_minutes,
        available_date,
        preview_lead_time,
        created_at,
        created_by,
        creator:created_by(name, class_name)
      `)
      .eq('status', 'published')
      .order('created_at', { ascending: false })

    // 특정 날짜의 문제만 조회 (당일 예약용)
    if (availableDate) {
      query = query.eq('available_date', availableDate)
    }

    const { data: problems, error } = await query

    if (error) {
      console.error('Database error:', error)
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