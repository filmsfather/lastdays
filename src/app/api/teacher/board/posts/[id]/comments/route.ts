import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'
import { getCurrentUser } from '@/lib/auth'

// GET: 특정 게시글의 댓글 목록 조회
export async function GET(
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
    const { data: post, error: postError } = await supabase
      .from('board_posts')
      .select('id')
      .eq('id', postId)
      .single()
    
    if (postError || !post) {
      return NextResponse.json(
        { success: false, error: '게시글을 찾을 수 없습니다.' },
        { status: 404 }
      )
    }
    
    // 댓글 목록 조회
    const { data: comments, error: commentsError } = await supabase
      .from('board_comments')
      .select(`
        *,
        accounts!board_comments_author_id_fkey(name, class_name)
      `)
      .eq('post_id', postId)
      .order('created_at', { ascending: true })
    
    if (commentsError) {
      throw commentsError
    }
    
    const commentsWithAuthor = comments?.map(comment => ({
      ...comment,
      author_name: comment.accounts?.name,
      author_class_name: comment.accounts?.class_name
    })) || []
    
    return NextResponse.json({
      success: true,
      comments: commentsWithAuthor
    })
  } catch (error) {
    console.error('댓글 목록 조회 오류:', error)
    return NextResponse.json(
      { success: false, error: '댓글을 불러오는데 실패했습니다.' },
      { status: 500 }
    )
  }
}