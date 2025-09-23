import { NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'

// GET: 활성화된 공지사항 목록 조회 (학생용)
export async function GET() {
  try {
    const { data: announcements, error } = await supabase
      .from('announcements')
      .select(`
        id,
        title,
        content,
        created_at,
        updated_at,
        creator:created_by(
          name,
          class_name
        )
      `)
      .eq('is_active', true)
      .order('created_at', { ascending: false })
      .limit(10)

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