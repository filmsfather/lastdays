import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'
import { getCurrentUser } from '@/lib/auth'

// GET: 게시글 목록 조회
export async function GET(request: NextRequest) {
  try {
    const user = await getCurrentUser()
    
    if (!user || user.role !== 'teacher') {
      return NextResponse.json(
        { success: false, error: '교사만 접근 가능합니다.' },
        { status: 403 }
      )
    }

    // 게시글 목록을 댓글 수와 함께 조회
    const { data: posts, error } = await supabase
      .from('board_posts')
      .select(`
        *,
        accounts!board_posts_author_id_fkey(name, class_name),
        board_comments(count)
      `)
      .order('created_at', { ascending: false })
    
    if (error) {
      throw error
    }
    
    // 댓글 수 계산을 위한 후처리
    const postsWithComments = posts?.map(post => ({
      ...post,
      author_name: post.accounts?.name,
      author_class_name: post.accounts?.class_name,
      comment_count: Array.isArray(post.board_comments) ? post.board_comments.length : 0
    })) || []
    
    return NextResponse.json({
      success: true,
      posts: postsWithComments
    })
  } catch (error) {
    console.error('게시글 목록 조회 오류:', error)
    return NextResponse.json(
      { success: false, error: '게시글을 불러오는데 실패했습니다.' },
      { status: 500 }
    )
  }
}

// POST: 새 게시글 작성
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
    const { title, content, is_anonymous = false } = body
    
    // 입력 검증
    if (!title || !content) {
      return NextResponse.json(
        { success: false, error: '제목과 내용을 모두 입력해주세요.' },
        { status: 400 }
      )
    }
    
    if (title.length > 200) {
      return NextResponse.json(
        { success: false, error: '제목은 200자 이내로 입력해주세요.' },
        { status: 400 }
      )
    }

    const { data: newPost, error } = await supabase
      .from('board_posts')
      .insert({
        title: title.trim(),
        content: content.trim(),
        is_anonymous,
        author_id: user.id
      })
      .select()
      .single()
    
    if (error) {
      throw error
    }
    
    return NextResponse.json({
      success: true,
      message: '게시글이 작성되었습니다.',
      post: {
        ...newPost,
        author_name: user.name,
        author_class_name: user.className,
        comment_count: 0
      }
    })
  } catch (error) {
    console.error('게시글 작성 오류:', error)
    return NextResponse.json(
      { success: false, error: '게시글 작성에 실패했습니다.' },
      { status: 500 }
    )
  }
}