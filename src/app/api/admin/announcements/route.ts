import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'
import { getCurrentUser } from '@/lib/auth'

// GET: 공지사항 목록 조회 (관리자용)
export async function GET(request: NextRequest) {
  const user = await getCurrentUser()
  if (!user || user.role !== 'admin') {
    return NextResponse.json({ success: false, error: '권한이 없습니다.' }, { status: 403 })
  }

  try {
    const { data: announcements, error } = await supabase
      .from('announcements')
      .select(`
        id,
        title,
        content,
        is_active,
        created_at,
        updated_at,
        creator:created_by(
          name,
          class_name
        )
      `)
      .order('created_at', { ascending: false })

    if (error) throw error

    // 데이터 변환
    const formattedAnnouncements = announcements.map((announcement: any) => ({
      ...announcement,
      creator_name: announcement.creator?.name || 'Unknown',
      creator_class: announcement.creator?.class_name || 'Unknown'
    }))

    return NextResponse.json({
      success: true,
      announcements: formattedAnnouncements
    })
  } catch (error) {
    console.error('공지사항 조회 실패:', error)
    return NextResponse.json(
      { success: false, error: '공지사항 조회에 실패했습니다.' },
      { status: 500 }
    )
  }
}

// POST: 공지사항 생성
export async function POST(request: NextRequest) {
  const user = await getCurrentUser()
  if (!user || user.role !== 'admin') {
    return NextResponse.json({ success: false, error: '권한이 없습니다.' }, { status: 403 })
  }

  try {
    const { title, content, isActive = true } = await request.json()

    if (!title || !content) {
      return NextResponse.json(
        { success: false, error: '제목과 내용을 입력해주세요.' },
        { status: 400 }
      )
    }

    const { data: announcement, error } = await supabase
      .from('announcements')
      .insert({
        title,
        content,
        is_active: isActive,
        created_by: user.id
      })
      .select('id, title, content, is_active, created_at')
      .single()

    if (error) throw error

    return NextResponse.json({
      success: true,
      message: '공지사항이 생성되었습니다.',
      announcement
    })
  } catch (error) {
    console.error('공지사항 생성 실패:', error)
    return NextResponse.json(
      { success: false, error: '공지사항 생성에 실패했습니다.' },
      { status: 500 }
    )
  }
}

// PUT: 공지사항 수정
export async function PUT(request: NextRequest) {
  const user = await getCurrentUser()
  if (!user || user.role !== 'admin') {
    return NextResponse.json({ success: false, error: '권한이 없습니다.' }, { status: 403 })
  }

  try {
    const { id, title, content, isActive } = await request.json()

    if (!id || !title || !content) {
      return NextResponse.json(
        { success: false, error: 'ID, 제목, 내용을 모두 입력해주세요.' },
        { status: 400 }
      )
    }

    const { data: announcement, error } = await supabase
      .from('announcements')
      .update({
        title,
        content,
        is_active: isActive,
        updated_at: new Date().toISOString()
      })
      .eq('id', id)
      .select('id, title, content, is_active, updated_at')
      .single()

    if (error) throw error

    if (!announcement) {
      return NextResponse.json(
        { success: false, error: '공지사항을 찾을 수 없습니다.' },
        { status: 404 }
      )
    }

    return NextResponse.json({
      success: true,
      message: '공지사항이 수정되었습니다.',
      announcement
    })
  } catch (error) {
    console.error('공지사항 수정 실패:', error)
    return NextResponse.json(
      { success: false, error: '공지사항 수정에 실패했습니다.' },
      { status: 500 }
    )
  }
}

// DELETE: 공지사항 삭제
export async function DELETE(request: NextRequest) {
  const user = await getCurrentUser()
  if (!user || user.role !== 'admin') {
    return NextResponse.json({ success: false, error: '권한이 없습니다.' }, { status: 403 })
  }

  try {
    const url = new URL(request.url)
    const id = url.searchParams.get('id')

    if (!id) {
      return NextResponse.json(
        { success: false, error: '공지사항 ID가 필요합니다.' },
        { status: 400 }
      )
    }

    const { data: announcement, error } = await supabase
      .from('announcements')
      .delete()
      .eq('id', parseInt(id))
      .select('id')
      .single()

    if (error) throw error

    if (!announcement) {
      return NextResponse.json(
        { success: false, error: '공지사항을 찾을 수 없습니다.' },
        { status: 404 }
      )
    }

    return NextResponse.json({
      success: true,
      message: '공지사항이 삭제되었습니다.'
    })
  } catch (error) {
    console.error('공지사항 삭제 실패:', error)
    return NextResponse.json(
      { success: false, error: '공지사항 삭제에 실패했습니다.' },
      { status: 500 }
    )
  }
}