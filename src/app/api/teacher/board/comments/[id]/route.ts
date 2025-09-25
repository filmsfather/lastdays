import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'
import { getCurrentUser } from '@/lib/auth'

// DELETE: 댓글 삭제
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
    const commentId = parseInt(resolvedParams.id)
    
    if (isNaN(commentId)) {
      return NextResponse.json(
        { success: false, error: '잘못된 댓글 ID입니다.' },
        { status: 400 }
      )
    }

    // 댓글 존재 및 작성자 확인
    const { data: comment, error: checkError } = await supabase
      .from('board_comments')
      .select('author_id')
      .eq('id', commentId)
      .single()
    
    if (checkError || !comment) {
      return NextResponse.json(
        { success: false, error: '댓글을 찾을 수 없습니다.' },
        { status: 404 }
      )
    }
    
    if (comment.author_id !== user.id) {
      return NextResponse.json(
        { success: false, error: '본인이 작성한 댓글만 삭제할 수 있습니다.' },
        { status: 403 }
      )
    }
    
    // 댓글 삭제
    const { error: deleteError } = await supabase
      .from('board_comments')
      .delete()
      .eq('id', commentId)
    
    if (deleteError) {
      throw deleteError
    }
    
    return NextResponse.json({
      success: true,
      message: '댓글이 삭제되었습니다.'
    })
  } catch (error) {
    console.error('댓글 삭제 오류:', error)
    return NextResponse.json(
      { success: false, error: '댓글 삭제에 실패했습니다.' },
      { status: 500 }
    )
  }
}

// PUT: 댓글 수정
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
    const commentId = parseInt(resolvedParams.id)
    
    if (isNaN(commentId)) {
      return NextResponse.json(
        { success: false, error: '잘못된 댓글 ID입니다.' },
        { status: 400 }
      )
    }

    const body = await request.json()
    const { content, is_anonymous } = body
    
    // 입력 검증
    if (!content) {
      return NextResponse.json(
        { success: false, error: '댓글 내용을 입력해주세요.' },
        { status: 400 }
      )
    }

    // 댓글 존재 및 작성자 확인
    const { data: existingComment, error: checkError } = await supabase
      .from('board_comments')
      .select('author_id')
      .eq('id', commentId)
      .single()
    
    if (checkError || !existingComment) {
      return NextResponse.json(
        { success: false, error: '댓글을 찾을 수 없습니다.' },
        { status: 404 }
      )
    }
    
    if (existingComment.author_id !== user.id) {
      return NextResponse.json(
        { success: false, error: '본인이 작성한 댓글만 수정할 수 있습니다.' },
        { status: 403 }
      )
    }
    
    // 댓글 수정
    const { data: updatedComment, error: updateError } = await supabase
      .from('board_comments')
      .update({
        content: content.trim(),
        is_anonymous,
        updated_at: new Date().toISOString()
      })
      .eq('id', commentId)
      .select()
      .single()
    
    if (updateError) {
      throw updateError
    }
    
    return NextResponse.json({
      success: true,
      message: '댓글이 수정되었습니다.',
      comment: updatedComment
    })
  } catch (error) {
    console.error('댓글 수정 오류:', error)
    return NextResponse.json(
      { success: false, error: '댓글 수정에 실패했습니다.' },
      { status: 500 }
    )
  }
}