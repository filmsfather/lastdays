import { NextRequest, NextResponse } from 'next/server'
import { getCurrentUser } from '@/lib/auth'
import { supabase } from '@/lib/supabase'

// GET /api/admin/slots - 슬롯 조회 (주간 조회 또는 특정 날짜/교사 조회)
export async function GET(request: NextRequest) {
  try {
    // 관리자 권한 확인
    const currentUser = await getCurrentUser()
    if (!currentUser || currentUser.role !== 'admin') {
      return NextResponse.json(
        { error: '관리자 권한이 필요합니다.' },
        { status: 403 }
      )
    }

    const { searchParams } = new URL(request.url)
    const week = searchParams.get('week')
    const date = searchParams.get('date')
    const teacherId = searchParams.get('teacherId')

    // 특정 날짜와 교사의 타임슬롯 조회
    if (date && teacherId) {
      const { data: slots, error } = await supabase
        .from('reservation_slots')
        .select(`
          id,
          date,
          time_slot,
          session_period,
          teacher_id,
          max_capacity,
          current_reservations,
          is_available,
          teacher:teacher_id(name)
        `)
        .eq('date', date)
        .eq('teacher_id', teacherId)
        .order('session_period', { ascending: true })
        .order('time_slot', { ascending: true })

      if (error) {
        console.error('Error fetching admin slots:', error)
        return NextResponse.json(
          { error: '슬롯 조회 중 오류가 발생했습니다.' },
          { status: 500 }
        )
      }

      const formattedSlots = slots?.map(slot => ({
        id: slot.id,
        date: slot.date,
        time_slot: slot.time_slot,
        session_period: slot.session_period,
        teacher_id: slot.teacher_id,
        teacher_name: (slot.teacher as any)?.name || '알 수 없음',
        max_capacity: slot.max_capacity,
        current_reservations: slot.current_reservations,
        is_available: slot.is_available
      })) || []

      return NextResponse.json({
        success: true,
        slots: formattedSlots
      })
    }

    // 주간 슬롯 조회 (기존 로직)
    if (!week_param) {
      return NextResponse.json(
        { error: 'week 파라미터가 필요합니다. (형식: YYYY-WW)' },
        { status: 400 }
      )
    }

    // 주차 형식 검증 (YYYY-WW)
    const weekRegex = /^\d{4}-\d{2}$/
    if (!weekRegex.test(week_param)) {
      return NextResponse.json(
        { error: '올바른 주차 형식이 아닙니다. (형식: YYYY-WW)' },
        { status: 400 }
      )
    }

    // 주차를 날짜 범위로 변환
    const [year, weekNum] = week_param.split('-').map(Number)
    const startDate = getDateOfWeek(year, weekNum, 1) // 월요일
    const endDate = getDateOfWeek(year, weekNum, 5)   // 금요일

    console.log('Fetching slots for week:', week_param, 'Date range:', startDate, 'to', endDate)

    // 슬롯 조회 (교사 정보 포함)
    const { data: slots, error } = await supabase
      .from('reservation_slots')
      .select(`
        *,
        teacher:teacher_id (
          id,
          name,
          class_name
        )
      `)
      .gte('date', startDate)
      .lte('date', endDate)
      .order('date', { ascending: true })
      .order('block', { ascending: true })

    if (error) {
      console.error('Error fetching slots:', error)
      return NextResponse.json(
        { error: '슬롯 조회 중 오류가 발생했습니다.' },
        { status: 500 }
      )
    }

    return NextResponse.json({
      success: true,
      week: week_param,
      dateRange: { startDate, endDate },
      slots: slots || []
    })

  } catch (error) {
    console.error('Get slots error:', error)
    return NextResponse.json(
      { error: '서버 오류가 발생했습니다.' },
      { status: 500 }
    )
  }
}

// POST /api/admin/slots - 주간 슬롯 생성
export async function POST(request: NextRequest) {
  try {
    // 관리자 권한 확인
    const currentUser = await getCurrentUser()
    if (!currentUser || currentUser.role !== 'admin') {
      return NextResponse.json(
        { error: '관리자 권한이 필요합니다.' },
        { status: 403 }
      )
    }

    const body = await request.json()
    const { date, teacherId, blocks } = body

    console.log('Creating slots:', { date, teacherId, blocks })

    // 입력값 검증
    if (!date || !teacherId || !blocks || !Array.isArray(blocks)) {
      return NextResponse.json(
        { error: 'date, teacherId, blocks(배열)이 필요합니다.' },
        { status: 400 }
      )
    }

    // 날짜 형식 검증
    const dateRegex = /^\d{4}-\d{2}-\d{2}$/
    if (!dateRegex.test(date)) {
      return NextResponse.json(
        { error: '올바른 날짜 형식이 아닙니다. (형식: YYYY-MM-DD)' },
        { status: 400 }
      )
    }

    // 교사 존재 확인
    const { data: teacher, error: teacherError } = await supabase
      .from('accounts')
      .select('id, name, role')
      .eq('id', teacherId)
      .eq('role', 'teacher')
      .single()

    if (teacherError || !teacher) {
      return NextResponse.json(
        { error: '유효하지 않은 교사 ID입니다.' },
        { status: 400 }
      )
    }

    // 블록 검증
    for (const block of blocks) {
      if (!block.block || !['AM', 'PM'].includes(block.block)) {
        return NextResponse.json(
          { error: 'blocks 배열의 각 항목은 block(AM 또는 PM)이 필요합니다.' },
          { status: 400 }
        )
      }

      if (!block.maxCapacity || block.maxCapacity < 1) {
        return NextResponse.json(
          { error: '최대 인원수(maxCapacity)는 1 이상이어야 합니다.' },
          { status: 400 }
        )
      }

    }

    // 슬롯 생성 준비
    const slotsToCreate = []

    for (const block of blocks) {
      // 중복 확인
      const { data: existingSlot, error: checkError } = await supabase
        .from('reservation_slots')
        .select('id')
        .eq('date', date)
        .eq('block', block.block)
        .eq('teacher_id', teacherId)
        .maybeSingle()

      if (checkError) {
        console.error('Error checking existing slot:', checkError)
        return NextResponse.json(
          { error: '슬롯 중복 확인 중 오류가 발생했습니다.' },
          { status: 500 }
        )
      }

      if (existingSlot) {
        return NextResponse.json(
          { 
            error: `${date} ${block.block === 'AM' ? '오전' : '오후'} ${teacher.name} 교사의 슬롯이 이미 존재합니다.` 
          },
          { status: 409 }
        )
      }

      slotsToCreate.push({
        date,
        block: block.block,
        teacher_id: teacherId,
        max_capacity: block.maxCapacity || 1,
        current_reservations: 0
      })
    }

    // 슬롯 일괄 생성
    const { data: createdSlots, error: createError } = await supabase
      .from('reservation_slots')
      .insert(slotsToCreate)
      .select(`
        *,
        teacher:teacher_id (
          id,
          name,
          class_name
        )
      `)

    if (createError) {
      console.error('Error creating slots:', createError)
      return NextResponse.json(
        { error: '슬롯 생성 중 오류가 발생했습니다.' },
        { status: 500 }
      )
    }

    console.log('Created slots:', createdSlots)

    return NextResponse.json({
      success: true,
      message: `${createdSlots.length}개의 슬롯이 생성되었습니다.`,
      slots: createdSlots
    })

  } catch (error) {
    console.error('Create slots error:', error)
    return NextResponse.json(
      { error: '서버 오류가 발생했습니다.' },
      { status: 500 }
    )
  }
}

// 주차의 특정 요일 날짜 계산 헬퍼 함수
function getDateOfWeek(year: number, week: number, dayOfWeek: number): string {
  // ISO 8601 주차 계산
  const simple = new Date(year, 0, 1 + (week - 1) * 7)
  const dow = simple.getDay()
  const ISOweekStart = simple
  
  if (dow <= 4) {
    ISOweekStart.setDate(simple.getDate() - simple.getDay() + 1)
  } else {
    ISOweekStart.setDate(simple.getDate() + 8 - simple.getDay())
  }
  
  const resultDate = new Date(ISOweekStart)
  resultDate.setDate(ISOweekStart.getDate() + dayOfWeek - 1)
  
  return resultDate.toISOString().split('T')[0]
}