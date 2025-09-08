import { NextRequest, NextResponse } from 'next/server'
import { getCurrentUser } from '@/lib/auth'
import { supabase } from '@/lib/supabase'

// POST /api/upload/images - 이미지 업로드
export async function POST(request: NextRequest) {
  try {
    const currentUser = await getCurrentUser()
    if (!currentUser) {
      return NextResponse.json(
        { error: '로그인이 필요합니다.' },
        { status: 401 }
      )
    }

    // 교사 권한 확인
    if (currentUser.role !== 'teacher') {
      return NextResponse.json(
        { error: '교사만 이미지를 업로드할 수 있습니다.' },
        { status: 403 }
      )
    }

    const formData = await request.formData()
    const file = formData.get('file') as File
    const problemId = formData.get('problemId') as string
    const altText = formData.get('altText') as string || '문제 이미지'

    if (!file) {
      return NextResponse.json(
        { error: '업로드할 파일이 없습니다.' },
        { status: 400 }
      )
    }

    // 파일 타입 검증
    const allowedTypes = ['image/jpeg', 'image/png', 'image/gif', 'image/webp']
    if (!allowedTypes.includes(file.type)) {
      return NextResponse.json(
        { error: '지원하지 않는 파일 형식입니다. (JPEG, PNG, GIF, WebP만 지원)' },
        { status: 400 }
      )
    }

    // 파일 크기 검증 (5MB 제한)
    const maxSize = 5 * 1024 * 1024 // 5MB
    if (file.size > maxSize) {
      return NextResponse.json(
        { error: '파일 크기는 5MB를 초과할 수 없습니다.' },
        { status: 400 }
      )
    }

    // 파일명 생성 (중복 방지를 위해 timestamp 추가)
    const timestamp = Date.now()
    const fileExt = file.name.split('.').pop()
    const fileName = problemId 
      ? `problem_${problemId}_${timestamp}.${fileExt}`
      : `temp_${currentUser.id}_${timestamp}.${fileExt}`

    try {
      // Supabase Storage에 파일 업로드
      const { data: uploadData, error: uploadError } = await supabase.storage
        .from('problem-images')
        .upload(fileName, file, {
          contentType: file.type,
          upsert: false
        })

      if (uploadError) {
        console.error('Supabase storage upload error:', uploadError)
        return NextResponse.json(
          { error: '이미지 업로드 중 오류가 발생했습니다.' },
          { status: 500 }
        )
      }

      // 업로드된 파일의 공개 URL 가져오기
      const { data: urlData } = supabase.storage
        .from('problem-images')
        .getPublicUrl(fileName)

      if (!urlData.publicUrl) {
        return NextResponse.json(
          { error: '이미지 URL을 생성할 수 없습니다.' },
          { status: 500 }
        )
      }

      return NextResponse.json({
        success: true,
        message: '이미지가 업로드되었습니다.',
        data: {
          url: urlData.publicUrl,
          fileName: fileName,
          altText: altText,
          size: file.size,
          type: file.type
        }
      })

    } catch (storageError) {
      console.error('Storage operation failed:', storageError)
      return NextResponse.json(
        { error: '스토리지 오류가 발생했습니다.' },
        { status: 500 }
      )
    }

  } catch (error) {
    console.error('Upload image error:', error)
    return NextResponse.json(
      { error: '서버 오류가 발생했습니다.' },
      { status: 500 }
    )
  }
}

// DELETE /api/upload/images - 이미지 삭제
export async function DELETE(request: NextRequest) {
  try {
    const currentUser = await getCurrentUser()
    if (!currentUser) {
      return NextResponse.json(
        { error: '로그인이 필요합니다.' },
        { status: 401 }
      )
    }

    // 교사 권한 확인
    if (currentUser.role !== 'teacher') {
      return NextResponse.json(
        { error: '교사만 이미지를 삭제할 수 있습니다.' },
        { status: 403 }
      )
    }

    const { searchParams } = new URL(request.url)
    const fileName = searchParams.get('fileName')

    if (!fileName) {
      return NextResponse.json(
        { error: '삭제할 파일명이 필요합니다.' },
        { status: 400 }
      )
    }

    // Supabase Storage에서 파일 삭제
    const { error: deleteError } = await supabase.storage
      .from('problem-images')
      .remove([fileName])

    if (deleteError) {
      console.error('Supabase storage delete error:', deleteError)
      return NextResponse.json(
        { error: '이미지 삭제 중 오류가 발생했습니다.' },
        { status: 500 }
      )
    }

    return NextResponse.json({
      success: true,
      message: '이미지가 삭제되었습니다.',
      fileName
    })

  } catch (error) {
    console.error('Delete image error:', error)
    return NextResponse.json(
      { error: '서버 오류가 발생했습니다.' },
      { status: 500 }
    )
  }
}