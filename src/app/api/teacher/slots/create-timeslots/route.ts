import { NextRequest, NextResponse } from 'next/server'
import { withTeacherOrAdmin } from '@/lib/middleware'
import { supabase } from '@/lib/supabase'

// 선생님/관리자용 타임슬롯 생성 API
export const POST = withTeacherOrAdmin(async (request) => {
  try {
    const body = await request.json()
    const { 
      date, 
      teacherId, 
      amStart = '10:00',
      amEnd = '15:50', 
      pmStart = '16:00',
      pmEnd = '21:50',
      intervalMinutes = 10,
      sessionOnly // 'AM', 'PM', 또는 null (둘 다)
    } = body

    // 입력값 검증
    if (!date || !teacherId) {
      return NextResponse.json(
        { error: '날짜와 교사 ID는 필수입니다.' },
        { status: 400 }
      )
    }

    // 선생님은 자신의 스케줄만 관리 가능
    if (request.user?.role === 'teacher' && teacherId !== request.user.id.toString()) {
      return NextResponse.json(
        { error: '자신의 스케줄만 관리할 수 있습니다.' },
        { status: 403 }
      )
    }

    // 교사 존재 확인
    const { data: teacher, error: teacherError } = await supabase
      .from('accounts')
      .select('id, name')
      .eq('id', teacherId)
      .eq('role', 'teacher')
      .single()

    if (teacherError || !teacher) {
      return NextResponse.json(
        { error: '존재하지 않는 교사입니다.' },
        { status: 404 }
      )
    }

    // sessionOnly가 지정된 경우 해당 세션만 생성
    let actualAmStart = amStart, actualAmEnd = amEnd, actualPmStart = pmStart, actualPmEnd = pmEnd
    
    if (sessionOnly === 'AM') {
      // PM 세션 비활성화 (시작시간을 종료시간보다 늦게 설정)
      actualPmStart = '23:59'
      actualPmEnd = '23:58'
    } else if (sessionOnly === 'PM') {
      // AM 세션 비활성화 (시작시간을 종료시간보다 늦게 설정)
      actualAmStart = '23:59'
      actualAmEnd = '23:58'
    }

    // PostgreSQL 함수 호출로 타임슬롯 생성
    console.log('Calling generate_time_slots with params:', {
      p_date: date,
      p_teacher_id: teacherId,
      p_am_start: actualAmStart,
      p_am_end: actualAmEnd,
      p_pm_start: actualPmStart,
      p_pm_end: actualPmEnd,
      p_interval_minutes: intervalMinutes
    })

    const { data: result, error } = await supabase
      .rpc('generate_time_slots', {
        p_date: date,
        p_teacher_id: teacherId,
        p_am_start: actualAmStart,
        p_am_end: actualAmEnd,
        p_pm_start: actualPmStart,
        p_pm_end: actualPmEnd,
        p_interval_minutes: intervalMinutes
      })

    console.log('Function result:', result)
    console.log('Function error:', error)

    if (error) {
      console.error('Error generating time slots:', error)
      console.error('Full error details:', JSON.stringify(error, null, 2))
      return NextResponse.json(
        { error: '타임슬롯 생성 중 오류가 발생했습니다.', details: error.message },
        { status: 500 }
      )
    }

    const sessionText = sessionOnly === 'AM' ? '오전' : sessionOnly === 'PM' ? '오후' : ''
    const sessionPrefix = sessionText ? `${sessionText} ` : ''

    return NextResponse.json({
      success: true,
      message: `${teacher.name} 선생님의 ${date} ${sessionPrefix}타임슬롯이 생성되었습니다.`,
      slotsCreated: result || 0,
      teacher: teacher.name,
      date: date
    })

  } catch (error) {
    console.error('Create timeslots error:', error)
    return NextResponse.json(
      { error: '서버 오류가 발생했습니다.' },
      { status: 500 }
    )
  }
})