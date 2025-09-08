import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { cookies } from 'next/headers'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

async function getCurrentUser() {
  try {
    const cookieStore = await cookies()
    const sessionCookie = cookieStore.get('session')
    const userCookie = cookieStore.get('user')
    
    if (!sessionCookie || !userCookie) {
      return null
    }

    const userInfo = JSON.parse(userCookie.value)
    
    const { data: user, error } = await supabase
      .from('accounts')
      .select('id, name, class_name, role')
      .eq('id', userInfo.id)
      .single()

    if (error) {
      console.error('사용자 조회 실패:', error)
      return null
    }

    return user
  } catch (error) {
    console.error('getCurrentUser 에러:', error)
    return null
  }
}

export async function GET() {
  try {
    const user = await getCurrentUser()
    
    if (!user || user.role !== 'teacher') {
      return NextResponse.json({
        success: false,
        error: '교사만 접근 가능합니다.'
      }, { status: 401 })
    }

    // 모든 학생 정보 조회 (role = 'student')
    const { data: students, error: studentsError } = await supabase
      .from('accounts')
      .select('id, name, class_name')
      .eq('role', 'student')
      .order('class_name', { ascending: true })
      .order('name', { ascending: true })

    if (studentsError) {
      console.error('학생 조회 실패:', studentsError)
      return NextResponse.json({
        success: false,
        error: '학생 정보를 불러오는데 실패했습니다.'
      }, { status: 500 })
    }

    // 각 학생별로 이용권과 배지 정보를 병렬로 조회
    const studentsWithStats = await Promise.all(
      students.map(async (student) => {
        try {
          // 이용권 조회
          const { data: ticketData, error: ticketError } = await supabase
            .from('accounts')
            .select('current_tickets')
            .eq('id', student.id)
            .single()

          if (ticketError && ticketError.code !== 'PGRST116') {
            console.error(`학생 ${student.id} 이용권 조회 실패:`, ticketError)
          }

          const remainingTickets = ticketData?.current_tickets || 0

          // 최근 3개 배지 조회
          const { data: badges, error: badgesError } = await supabase
            .from('student_badges')
            .select('badge_type, earned_at')
            .eq('student_id', student.id)
            .order('earned_at', { ascending: false })
            .limit(3)

          if (badgesError) {
            console.error(`학생 ${student.id} 배지 조회 실패:`, badgesError)
          }

          return {
            id: student.id,
            name: student.name,
            class_name: student.class_name,
            remaining_tickets: remainingTickets,
            recent_badges: badges || []
          }
        } catch (error) {
          console.error(`학생 ${student.id} 데이터 처리 실패:`, error)
          return {
            id: student.id,
            name: student.name,
            class_name: student.class_name,
            remaining_tickets: 0,
            recent_badges: []
          }
        }
      })
    )

    // 반별로 그룹핑
    const classGroups = studentsWithStats.reduce((groups, student) => {
      const className = student.class_name
      if (!groups[className]) {
        groups[className] = []
      }
      groups[className].push(student)
      return groups
    }, {} as Record<string, typeof studentsWithStats>)

    // 반별 섹션으로 변환
    const classStats = Object.entries(classGroups)
      .map(([className, students]) => ({
        class_name: className,
        students: students
      }))
      .sort((a, b) => a.class_name.localeCompare(b.class_name))

    // 전체 통계 계산
    const totalStudents = studentsWithStats.length
    const totalTickets = studentsWithStats.reduce((sum, student) => sum + student.remaining_tickets, 0)
    const averageTickets = totalStudents > 0 ? Math.round(totalTickets / totalStudents) : 0

    return NextResponse.json({
      success: true,
      classStats,
      summary: {
        totalClasses: classStats.length,
        totalStudents,
        totalTickets,
        averageTickets
      }
    })

  } catch (error) {
    console.error('학생 목록 조회 API 에러:', error)
    return NextResponse.json({
      success: false,
      error: '서버 오류가 발생했습니다.'
    }, { status: 500 })
  }
}