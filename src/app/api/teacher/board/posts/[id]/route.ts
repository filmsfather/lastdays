import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'
import { getCurrentUser } from '@/lib/auth'

// GET: 게시글 상세 조회
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

    const { data: post, error } = await supabase
      .from('board_posts')
      .select(`
        *,
        accounts!board_posts_author_id_fkey(name, class_name)
      `)
      .eq('id', postId)
      .single()
    
    if (error || !post) {
      return NextResponse.json(
        { success: false, error: '게시글을 찾을 수 없습니다.' },
        { status: 404 }
      )
    }
    
    return NextResponse.json({
      success: true,
      post: {
        ...post,
        author_name: post.accounts?.name,
        author_class_name: post.accounts?.class_name
      }
    })
  } catch (error) {
    console.error('게시글 상세 조회 오류:', error)
    return NextResponse.json(
      { success: false, error: '게시글을 불러오는데 실패했습니다.' },
      { status: 500 }
    )
  }
}

// PUT: 게시글 수정
export async function PUT(
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

    const body = await request.json()
    const { title, content, is_anonymous } = body
    
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

    // 게시글 존재 및 작성자 확인
    const { data: existingPost, error: checkError } = await supabase
      .from('board_posts')
      .select('author_id')
      .eq('id', postId)
      .single()
    
    if (checkError || !existingPost) {
      return NextResponse.json(
        { success: false, error: '게시글을 찾을 수 없습니다.' },
        { status: 404 }
      )
    }
    
    if (existingPost.author_id !== user.id) {
      return NextResponse.json(
        { success: false, error: '본인이 작성한 게시글만 수정할 수 있습니다.' },
        { status: 403 }
      )
    }
    
    // 게시글 수정
    const { data: updatedPost, error: updateError } = await supabase
      .from('board_posts')
      .update({
        title: title.trim(),
        content: content.trim(),
        is_anonymous,
        updated_at: new Date().toISOString()
      })
      .eq('id', postId)
      .select()
      .single()
    
    if (updateError) {
      throw updateError
    }
    
    return NextResponse.json({
      success: true,
      message: '게시글이 수정되었습니다.',
      post: updatedPost
    })
  } catch (error) {
    console.error('게시글 수정 오류:', error)
    return NextResponse.json(
      { success: false, error: '게시글 수정에 실패했습니다.' },
      { status: 500 }
    )
  }
}

// DELETE: 게시글 삭제
export async function DELETE(
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

    // 게시글 존재 및 작성자 확인
    const { data: existingPost, error: checkError } = await supabase
      .from('board_posts')
      .select('author_id')
      .eq('id', postId)
      .single()
    
    if (checkError || !existingPost) {
      return NextResponse.json(
        { success: false, error: '게시글을 찾을 수 없습니다.' },
        { status: 404 }
      )
    }
    
    if (existingPost.author_id !== user.id) {
      return NextResponse.json(
        { success: false, error: '본인이 작성한 게시글만 삭제할 수 있습니다.' },
        { status: 403 }
      )
    }
    
    // 게시글 삭제 (외래키 제약조건으로 댓글도 자동 삭제됨)
    const { error: deleteError } = await supabase
      .from('board_posts')
      .delete()
      .eq('id', postId)
    
    if (deleteError) {
      throw deleteError
    }
    
    return NextResponse.json({
      success: true,
      message: '게시글이 삭제되었습니다.'
    })
  } catch (error) {
    console.error('게시글 삭제 오류:', error)
    return NextResponse.json(
      { success: false, error: '게시글 삭제에 실패했습니다.' },
      { status: 500 }
    )
  }
}