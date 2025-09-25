import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'
import { getCurrentUser } from '@/lib/auth'

// POST: 새 댓글 작성
export async function POST(request: NextRequest) {
  try {
    const user = await getCurrentUser()
    
    if (!user || user.role !== 'teacher') {
      return NextResponse.json(
        { success: false, error: '교사만 접근 가능합니다.' },
        { status: 403 }
      )
    }

    const body = await request.json()
    const { post_id, content, is_anonymous = false } = body
    
    // 입력 검증
    if (!post_id || !content) {
      return NextResponse.json(
        { success: false, error: '게시글 ID와 댓글 내용을 모두 입력해주세요.' },
        { status: 400 }
      )
    }
    
    if (typeof post_id !== 'number' || isNaN(post_id)) {
      return NextResponse.json(
        { success: false, error: '잘못된 게시글 ID입니다.' },
        { status: 400 }
      )
    }

    // 게시글 존재 확인
    const { data: post, error: postError } = await supabase
      .from('board_posts')
      .select('id')
      .eq('id', post_id)
      .single()
    
    if (postError || !post) {
      return NextResponse.json(
        { success: false, error: '게시글을 찾을 수 없습니다.' },
        { status: 404 }
      )
    }
    
    // 댓글 작성
    const { data: newComment, error: commentError } = await supabase
      .from('board_comments')
      .insert({
        post_id,
        content: content.trim(),
        is_anonymous,
        author_id: user.id
      })
      .select()
      .single()
    
    if (commentError) {
      throw commentError
    }
    
    return NextResponse.json({
      success: true,
      message: '댓글이 작성되었습니다.',
      comment: {
        ...newComment,
        author_name: user.name,
        author_class_name: user.className
      }
    })
  } catch (error) {
    console.error('댓글 작성 오류:', error)
    return NextResponse.json(
      { success: false, error: '댓글 작성에 실패했습니다.' },
      { status: 500 }
    )
  }
}