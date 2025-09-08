import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

interface User {
  id: number
  name: string
  class_name: string
  role: string
}

interface TodaySlot {
  id: number
  time_slot: string
  session_period: number
  student_count: number
  max_capacity: number
  reservations: {
    id: number
    student: {
      id: number
      name: string
      class_name: string
    }
    problem_selected: boolean
    status: string
    session?: {
      id: number
      status: string
    }
  }[]
}

// 시간 슬롯 포맷팅 (10분 세션)
function formatTimeSlot(timeSlot: string): string {
  if (!timeSlot) return '시간 미정'
  
  // HH:MM:SS 형식에서 HH:MM만 추출
  const timeOnly = timeSlot.slice(0, 5)  // "10:00:00" -> "10:00"
  const [hours, minutes] = timeOnly.split(':').map(Number)
  
  const startTime = new Date()
  startTime.setHours(hours, minutes, 0, 0)
  
  // 10분 세션으로 종료 시간 계산
  const endTime = new Date(startTime.getTime() + 10 * 60000)
  
  // 시간 포맷팅
  const formatTime = (date: Date) => {
    return `${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`
  }
  
  return `${formatTime(startTime)}-${formatTime(endTime)}`
}

// 상태 텍스트 및 스타일
function getStatusBadge(reservation: any) {
  if (reservation.session) {
    switch (reservation.session.status) {
      case 'completed':
        return { text: '완료', className: 'bg-green-100 text-green-800' }
      case 'in_progress':
        return { text: '진행중', className: 'bg-blue-100 text-blue-800' }
      default:
        return { text: '세션생성됨', className: 'bg-purple-100 text-purple-800' }
    }
  } else if (reservation.problem_selected) {
    return { text: '문제선택완료', className: 'bg-yellow-100 text-yellow-800' }
  } else {
    return { text: '대기중', className: 'bg-gray-100 text-gray-800' }
  }
}

async function getCurrentUser(): Promise<User | null> {
  // 개발환경에서는 테스트용 교사 사용자 반환
  if (process.env.NODE_ENV === 'development') {
    return {
      id: 14,  // 실제 Supabase의 교사 ID
      name: '김선생',
      class_name: '수학교사',
      role: 'teacher'
    }
  }
  
  // 프로덕션에서는 Supabase 직접 호출
  try {
    const cookieStore = await cookies()
    const authCookie = cookieStore.get('auth')
    
    if (!authCookie) {
      return null
    }

    const { data: user, error } = await supabase
      .from('accounts')
      .select('id, name, class_name, role')
      .eq('id', parseInt(authCookie.value))
      .single()

    if (error) {
      console.error('사용자 조회 실패:', error)
      return null
    }

    return user
  } catch (error) {
    console.error('사용자 정보 조회 실패:', error)
    return null
  }
}

async function getTodaySchedule(teacherId: number): Promise<TodaySlot[]> {
  try {
    // 오늘 날짜 (KST 기준)
    const today = new Date()
    today.setHours(today.getHours() + 9) // UTC to KST
    const todayString = today.toISOString().split('T')[0]

    // 교사의 당일 슬롯 조회
    const { data: slots, error: slotsError } = await supabase
      .from('reservation_slots')
      .select(`
        id,
        time_slot,
        session_period,
        max_capacity,
        reservations (
          id,
          status,
          problem_selected,
          created_at,
          student:accounts!reservations_student_id_fkey (
            id,
            name,
            class_name
          ),
          sessions (
            id,
            status
          )
        )
      `)
      .eq('date', todayString)
      .eq('teacher_id', teacherId)
      .order('time_slot', { ascending: true })

    if (slotsError) {
      console.error('슬롯 조회 실패:', slotsError)
      return []
    }

    // 슬롯 데이터 처리
    const processedSlots = slots?.map(slot => {
      // 활성 예약만 필터링 (취소된 것 제외)
      const activeReservations = slot.reservations?.filter(
        (reservation: any) => reservation.status === 'active'
      ) || []

      // 예약 시간순으로 정렬
      activeReservations.sort((a: any, b: any) => {
        return new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
      })

      return {
        id: slot.id,
        time_slot: slot.time_slot,
        session_period: slot.session_period,
        max_capacity: slot.max_capacity,
        student_count: activeReservations.length,
        reservations: activeReservations.map((reservation: any) => ({
          id: reservation.id,
          student: reservation.student,
          problem_selected: reservation.problem_selected,
          status: reservation.status,
          session: reservation.sessions?.[0] || null
        }))
      }
    }) || []

    return processedSlots
  } catch (error) {
    console.error('당일 스케줄 조회 실패:', error)
    return []
  }
}

export default async function TeacherTodayPage() {
  const user = await getCurrentUser()
  
  if (!user || user.role !== 'teacher') {
    redirect('/login')
  }

  const todaySlots = await getTodaySchedule(user.id)
  const today = new Date().toLocaleDateString('ko-KR', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    weekday: 'long'
  })

  return (
    <div className="min-h-screen bg-gray-100">
      <div className="container mx-auto px-4 py-8">
        {/* 헤더 */}
        <div className="bg-white rounded-lg shadow-md p-6 mb-6">
          <div className="flex justify-between items-center">
            <div>
              <h1 className="text-2xl font-bold text-gray-800">
                오늘의 수업 스케줄
              </h1>
              <p className="text-gray-600">{today}</p>
              <p className="text-sm text-gray-500">{user.name} 선생님 • {user.class_name}</p>
            </div>
            <div className="flex space-x-4">
              <Link 
                href="/dashboard/teacher/students"
                className="px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors"
              >
                학생 관리
              </Link>
              <Link 
                href="/dashboard/teacher"
                className="px-4 py-2 bg-gray-500 text-white rounded-lg hover:bg-gray-600 transition-colors"
              >
                메인 대시보드
              </Link>
            </div>
          </div>
        </div>

        {/* 스케줄 목록 */}
        <div className="space-y-4">
          {todaySlots.length === 0 ? (
            <div className="bg-white rounded-lg shadow-md p-8 text-center">
              <div className="text-gray-400 mb-4">
                <svg className="mx-auto h-12 w-12" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z"/>
                </svg>
              </div>
              <h3 className="text-lg font-medium text-gray-600 mb-2">
                오늘은 예정된 수업이 없습니다
              </h3>
              <p className="text-gray-500">
                새로운 예약이 들어오면 자동으로 표시됩니다
              </p>
            </div>
          ) : (
            todaySlots.map((slot) => (
              <div key={slot.id} className="bg-white rounded-lg shadow-md p-6">
                {/* 슬롯 헤더 */}
                <div className="flex justify-between items-center mb-4 pb-4 border-b">
                  <div>
                    <h3 className="text-xl font-semibold text-gray-800">
                      {formatTimeSlot(slot.time_slot)}
                    </h3>
                    <p className="text-sm text-gray-500">
                      {slot.student_count}/{slot.max_capacity}명 예약
                    </p>
                  </div>
                  <div className="text-right">
                    <span className={`px-3 py-1 rounded-full text-sm font-medium ${
                      slot.student_count === slot.max_capacity 
                        ? 'bg-red-100 text-red-800' 
                        : slot.student_count > 0
                        ? 'bg-yellow-100 text-yellow-800'
                        : 'bg-gray-100 text-gray-800'
                    }`}>
                      {slot.student_count === 0 
                        ? '예약없음'
                        : slot.student_count === slot.max_capacity
                        ? '만석'
                        : '진행중'}
                    </span>
                  </div>
                </div>

                {/* 예약 학생 목록 */}
                {slot.reservations.length > 0 ? (
                  <div className="space-y-3">
                    {slot.reservations.map((reservation, index) => {
                      const statusBadge = getStatusBadge(reservation)
                      return (
                        <div 
                          key={reservation.id}
                          className="flex justify-between items-center p-4 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors"
                        >
                          <div className="flex items-center space-x-4">
                            <div className="flex items-center justify-center w-8 h-8 bg-blue-100 text-blue-800 rounded-full text-sm font-medium">
                              {index + 1}
                            </div>
                            <div>
                              <p className="font-medium text-gray-800">
                                {reservation.student.name}
                              </p>
                              <p className="text-sm text-gray-500">
                                {reservation.student.class_name}
                              </p>
                            </div>
                          </div>
                          
                          <div className="flex items-center space-x-3">
                            <div className="text-center">
                              <p className="text-xs text-gray-500">문제선택</p>
                              <div className={`w-3 h-3 rounded-full mx-auto ${
                                reservation.problem_selected ? 'bg-green-500' : 'bg-red-300'
                              }`}></div>
                            </div>
                            
                            <span className={`px-2 py-1 rounded text-xs font-medium ${statusBadge.className}`}>
                              {statusBadge.text}
                            </span>

                            {reservation.session && (
                              <Link
                                href={`/session/${reservation.session.id}/feedback`}
                                className="px-3 py-1 bg-blue-500 text-white text-sm rounded hover:bg-blue-600 transition-colors"
                              >
                                피드백
                              </Link>
                            )}
                          </div>
                        </div>
                      )
                    })}
                  </div>
                ) : (
                  <div className="text-center py-8">
                    <p className="text-gray-500">이 시간대에는 예약이 없습니다</p>
                  </div>
                )}
              </div>
            ))
          )}
        </div>

        {/* 하단 도움말 */}
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mt-6">
          <h4 className="font-medium text-blue-800 mb-2">도움말</h4>
          <div className="text-sm text-blue-700 space-y-1">
            <p>• 각 시간대별로 예약된 학생들의 현황을 실시간으로 확인할 수 있습니다</p>
            <p>• 문제선택이 완료되고 세션이 생성된 학생은 &apos;피드백&apos; 버튼으로 바로 이동 가능합니다</p>
            <p>• 순번은 예약 시간 순서대로 자동 배정됩니다</p>
          </div>
        </div>
      </div>
    </div>
  )
}