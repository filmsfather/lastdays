import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'
import { getCurrentUser } from '@/lib/auth'

// 관리자 전용 - 계정 수정
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    // 관리자 권한 확인
    const user = await getCurrentUser()
    if (!user || user.role !== 'admin') {
      return NextResponse.json(
        { error: '접근 권한이 없습니다.' },
        { status: 403 }
      )
    }

    const { id } = await params
    const body = await req.json()
    const { name, className, role, pin } = body

    // 계정 존재 확인
    const { data: existingAccount, error: fetchError } = await supabase
      .from('accounts')
      .select('*')
      .eq('id', id)
      .single()

    if (fetchError || !existingAccount) {
      return NextResponse.json(
        { error: '계정을 찾을 수 없습니다.' },
        { status: 404 }
      )
    }

    // 업데이트 데이터 준비
    const updateData: any = {}

    if (name !== undefined) updateData.name = name
    if (className !== undefined) updateData.class_name = className
    if (role !== undefined) {
      if (!['student', 'teacher', 'admin'].includes(role)) {
        return NextResponse.json(
          { error: '유효하지 않은 역할입니다.' },
          { status: 400 }
        )
      }
      updateData.role = role
    }
    if (pin !== undefined) {
      if (pin.length !== 4 || !/^\d{4}$/.test(pin)) {
        return NextResponse.json(
          { error: 'PIN은 4자리 숫자여야 합니다.' },
          { status: 400 }
        )
      }
      updateData.pin = pin
    }

    // 업데이트할 데이터가 없는 경우
    if (Object.keys(updateData).length === 0) {
      return NextResponse.json(
        { error: '수정할 데이터가 없습니다.' },
        { status: 400 }
      )
    }

    // 중복 계정 확인 (이름과 반이 변경되는 경우)
    if (updateData.name || updateData.class_name) {
      const checkName = updateData.name || existingAccount.name
      const checkClassName = updateData.class_name || existingAccount.class_name

      const { data: duplicateAccount } = await supabase
        .from('accounts')
        .select('id')
        .eq('name', checkName)
        .eq('class_name', checkClassName)
        .neq('id', id)
        .single()

      if (duplicateAccount) {
        return NextResponse.json(
          { error: '이미 존재하는 계정입니다.' },
          { status: 409 }
        )
      }
    }

    // 계정 업데이트
    const { data: updatedAccount, error } = await supabase
      .from('accounts')
      .update(updateData)
      .eq('id', id)
      .select()
      .single()

    if (error) {
      return NextResponse.json(
        { error: '계정 수정 중 오류가 발생했습니다.' },
        { status: 500 }
      )
    }

    return NextResponse.json({
      success: true,
      account: updatedAccount
    })
  } catch (error) {
    console.error('Update account error:', error)
    return NextResponse.json(
      { error: '서버 오류가 발생했습니다.' },
      { status: 500 }
    )
  }
}

// 관리자 전용 - 계정 삭제
export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    // 관리자 권한 확인
    const user = await getCurrentUser()
    if (!user || user.role !== 'admin') {
      return NextResponse.json(
        { error: '접근 권한이 없습니다.' },
        { status: 403 }
      )
    }

    const { id } = await params

    // 계정 존재 확인
    const { data: existingAccount, error: fetchError } = await supabase
      .from('accounts')
      .select('*')
      .eq('id', id)
      .single()

    if (fetchError || !existingAccount) {
      return NextResponse.json(
        { error: '계정을 찾을 수 없습니다.' },
        { status: 404 }
      )
    }

    // 관리자 계정 삭제 방지
    if (existingAccount.role === 'admin') {
      return NextResponse.json(
        { error: '관리자 계정은 삭제할 수 없습니다.' },
        { status: 403 }
      )
    }

    // 계정 삭제
    const { error } = await supabase
      .from('accounts')
      .delete()
      .eq('id', id)

    if (error) {
      return NextResponse.json(
        { error: '계정 삭제 중 오류가 발생했습니다.' },
        { status: 500 }
      )
    }

    return NextResponse.json({
      success: true,
      message: '계정이 삭제되었습니다.'
    })
  } catch (error) {
    console.error('Delete account error:', error)
    return NextResponse.json(
      { error: '서버 오류가 발생했습니다.' },
      { status: 500 }
    )
  }
}