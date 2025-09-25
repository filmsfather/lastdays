import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'
import { getCurrentUser } from '@/lib/auth'

// POST: 게시글 조회수 증가
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await getCurrentUser()
    
    if (!user || user.role !== 'teacher') {
      return NextResponse.json(
        { success: false, error: '교사만 접근 가능합니다.' },
        { status: 403 }
      )
    }

    const resolvedParams = await params
    const postId = parseInt(resolvedParams.id)
    
    if (isNaN(postId)) {
      return NextResponse.json(
        { success: false, error: '잘못된 게시글 ID입니다.' },
        { status: 400 }
      )
    }

    // 게시글 존재 확인
    const { data: post, error: findError } = await supabase
      .from('board_posts')
      .select('view_count')
      .eq('id', postId)
      .single()
    
    if (findError || !post) {
      return NextResponse.json(
        { success: false, error: '게시글을 찾을 수 없습니다.' },
        { status: 404 }
      )
    }
    
    // 조회수 증가
    const { data: updatedPost, error: updateError } = await supabase
      .from('board_posts')
      .update({ 
        view_count: post.view_count + 1,
        updated_at: new Date().toISOString()
      })
      .eq('id', postId)
      .select('view_count')
      .single()
    
    if (updateError) {
      throw updateError
    }
    
    return NextResponse.json({
      success: true,
      view_count: updatedPost.view_count
    })
  } catch (error) {
    console.error('조회수 증가 오류:', error)
    return NextResponse.json(
      { success: false, error: '조회수 업데이트에 실패했습니다.' },
      { status: 500 }
    )
  }
}