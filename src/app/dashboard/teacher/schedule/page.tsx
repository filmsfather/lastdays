'use client'

import { useState, useEffect } from 'react'
import { toast } from 'react-hot-toast'
import Link from 'next/link'

interface User {
  id: number
  name: string
  className: string
  role: string
}

interface TimeSlot {
  id: number
  date: string
  time_slot: string
  session_period: 'AM' | 'PM'
  teacher_id: number
  teacher_name: string
  max_capacity: number
  current_reservations: number
  is_available: boolean
}

export default function TeacherSchedulePage() {
  const [user, setUser] = useState<User | null>(null)
  const [timeSlots, setTimeSlots] = useState<TimeSlot[]>([])
  const [loading, setLoading] = useState(false)
  const [currentWeekStart, setCurrentWeekStart] = useState<Date>(new Date())
  
  // 빠른 생성 설정
  const [quickCreateConfig, setQuickCreateConfig] = useState({
    amStart: '10:00',
    amEnd: '15:50',
    pmStart: '16:00',
    pmEnd: '21:50',
    intervalMinutes: 10
  })

  // 현재 사용자 정보 조회
  useEffect(() => {
    async function fetchCurrentUser() {
      try {
        const response = await fetch('/api/auth/me', {
          credentials: 'include'
        })
        const data = await response.json()
        
        if (data.success) {
          setUser(data.user)
          if (data.user.role !== 'teacher') {
            toast.error('교사만 접근 가능한 페이지입니다.')
            window.location.href = '/login'
            return
          }
        } else {
          window.location.href = '/login'
          return
        }
      } catch (error) {
        console.error('사용자 정보 조회 실패:', error)
        window.location.href = '/login'
      }
    }

    fetchCurrentUser()
  }, [])

  // 주간 시작일 계산 (월요일 기준)
  const getWeekStart = (date: Date) => {
    const d = new Date(date)
    const day = d.getDay()
    const diff = d.getDate() - day + (day === 0 ? -6 : 1)
    return new Date(d.setDate(diff))
  }

  // 주간 날짜 배열 생성
  const getWeekDates = (weekStart: Date) => {
    const dates = []
    for (let i = 0; i < 7; i++) {
      const date = new Date(weekStart)
      date.setDate(weekStart.getDate() + i)
      dates.push(date)
    }
    return dates
  }

  useEffect(() => {
    // 현재 주의 월요일로 설정
    const weekStart = getWeekStart(new Date())
    setCurrentWeekStart(weekStart)
  }, [])

  // 빠른 슬롯 생성 (일정 시간 범위에서 자동 생성)
  const createQuickSlots = async (date: string, sessionPeriod: 'AM' | 'PM') => {
    if (!user) {
      toast.error('사용자 정보를 불러오는 중입니다.')
      return
    }

    const config = {
      date,
      teacherId: user.id.toString(),
      amStart: quickCreateConfig.amStart,
      amEnd: quickCreateConfig.amEnd,
      pmStart: quickCreateConfig.pmStart,
      pmEnd: quickCreateConfig.pmEnd,
      intervalMinutes: quickCreateConfig.intervalMinutes,
      sessionOnly: sessionPeriod // 특정 세션만 생성
    }

    try {
      const response = await fetch('/api/teacher/slots/create-timeslots', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(config),
      })

      const data = await response.json()

      if (data.success) {
        toast.success(`${sessionPeriod === 'AM' ? '오전' : '오후'} 슬롯이 생성되었습니다.`)
        fetchWeekSlots()
      } else {
        toast.error(data.error || '슬롯 생성에 실패했습니다.')
      }
    } catch (error) {
      console.error('슬롯 생성 실패:', error)
      toast.error('슬롯 생성 중 오류가 발생했습니다.')
    }
  }

  const toggleBreakTime = async (slot: TimeSlot) => {
    if (!slot.is_available && slot.current_reservations > 0) {
      toast.error('예약이 있는 슬롯은 쉬는시간으로 설정할 수 없습니다.')
      return
    }

    try {
      const response = await fetch('/api/teacher/slots/manage-timeslots', {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          date: slot.date,
          timeSlot: slot.time_slot,
          teacherId: slot.teacher_id,
          isBreak: slot.is_available // 현재 available이면 break로 변경
        }),
      })

      const data = await response.json()

      if (data.success) {
        toast.success(data.message)
        fetchWeekSlots()
      } else {
        toast.error(data.error || '설정 변경에 실패했습니다.')
      }
    } catch (error) {
      console.error('쉬는시간 설정 실패:', error)
      toast.error('설정 변경 중 오류가 발생했습니다.')
    }
  }

  const formatTimeSlot = (timeSlot: string) => {
    return timeSlot
  }

  // 주간 네비게이션
  const goToPreviousWeek = () => {
    const newWeekStart = new Date(currentWeekStart)
    newWeekStart.setDate(newWeekStart.getDate() - 7)
    setCurrentWeekStart(newWeekStart)
  }

  const goToNextWeek = () => {
    const newWeekStart = new Date(currentWeekStart)
    newWeekStart.setDate(newWeekStart.getDate() + 7)
    setCurrentWeekStart(newWeekStart)
  }

  const goToCurrentWeek = () => {
    setCurrentWeekStart(getWeekStart(new Date()))
  }

  // 날짜별 슬롯 그룹핑 (AM/PM 세션별로 분리)
  const getSlotsByDate = (date: Date) => {
    const dateString = date.toISOString().split('T')[0]
    const daySlots = timeSlots.filter(slot => slot.date === dateString)
    
    return {
      AM: daySlots.filter(slot => slot.session_period === 'AM').sort((a, b) => a.time_slot.localeCompare(b.time_slot)),
      PM: daySlots.filter(slot => slot.session_period === 'PM').sort((a, b) => a.time_slot.localeCompare(b.time_slot))
    }
  }

  // 날짜 포맷팅 (간단)
  const formatDateShort = (date: Date) => {
    const month = date.getMonth() + 1
    const day = date.getDate()
    const weekday = ['일', '월', '화', '수', '목', '금', '토'][date.getDay()]
    return `${month}/${day} (${weekday})`
  }

  // 주간 타임슬롯 조회
  const fetchWeekSlots = async () => {
    if (!user) {
      setTimeSlots([])
      return
    }

    setLoading(true)
    try {
      const promises = []
      for (let i = 0; i < 7; i++) {
        const date = new Date(currentWeekStart)
        date.setDate(currentWeekStart.getDate() + i)
        const dateString = date.toISOString().split('T')[0]
        
        const promise = fetch(`/api/teacher/slots?date=${dateString}&teacherId=${user.id}`)
          .then(res => res.json())
          .then(data => data.success ? data.slots : [])
        
        promises.push(promise)
      }
      
      const results = await Promise.all(promises)
      const allSlots = results.flat()
      setTimeSlots(allSlots)
    } catch (error) {
      console.error('주간 타임슬롯 조회 실패:', error)
      toast.error('타임슬롯 조회에 실패했습니다.')
    } finally {
      setLoading(false)
    }
  }

  // 사용자 정보와 주간 변경 시 슬롯 조회
  useEffect(() => {
    if (user) {
      fetchWeekSlots()
    }
  }, [user, currentWeekStart])

  if (!user) {
    return (
      <div className="min-h-screen bg-gray-100 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-blue-500 mx-auto"></div>
          <p className="mt-4 text-gray-600">사용자 정보를 불러오는 중...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen gradient-bg">
      {/* Navigation */}
      <nav className="bg-white/80 backdrop-blur-sm border-b border-white/20 sticky top-0 z-40">
        <div className="max-w-7xl mx-auto px-6 py-4">
          <div className="flex justify-between items-center">
            <div className="flex items-center space-x-3">
              <div className="w-8 h-8 bg-green-600 rounded-xl flex items-center justify-center">
                <span className="text-white font-bold text-sm">T</span>
              </div>
              <div>
                <span className="text-lg font-bold text-gray-900">{user.name} 선생님</span>
                <p className="text-sm text-gray-600">내 스케줄 관리</p>
              </div>
            </div>
            <Link href="/dashboard/teacher" className="btn-ghost">
              ← 교사 대시보드
            </Link>
          </div>
        </div>
      </nav>

      <div className="max-w-7xl mx-auto px-6 py-8">
        <div className="mb-8">
          <h1 className="text-4xl font-bold text-gray-900 mb-2">내 스케줄 관리</h1>
          <p className="text-xl text-gray-600">나만의 수업 시간을 생성하고 쉬는시간을 설정하세요</p>
        </div>

        {/* 주간 타임슬롯 관리 */}
        <div className="card">
          <h2 className="text-2xl font-bold text-gray-900 mb-6">주간 스케줄</h2>
          
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
            {/* 빠른 생성 설정 */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">간격 설정</label>
              <select
                value={quickCreateConfig.intervalMinutes}
                onChange={(e) => setQuickCreateConfig(prev => ({ ...prev, intervalMinutes: parseInt(e.target.value) }))}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              >
                <option value={10}>10분 간격</option>
                <option value={15}>15분 간격</option>
                <option value={20}>20분 간격</option>
                <option value={30}>30분 간격</option>
              </select>
            </div>

            {/* 시간 범위 빠른 설정 */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">시간대 설정</label>
              <div className="flex space-x-2 text-sm">
                <div>
                  <span className="text-gray-600">오전:</span>
                  <input
                    type="time"
                    value={quickCreateConfig.amStart}
                    onChange={(e) => setQuickCreateConfig(prev => ({ ...prev, amStart: e.target.value }))}
                    className="w-16 px-1 py-1 border border-gray-300 rounded text-xs"
                  />
                  <span>-</span>
                  <input
                    type="time"
                    value={quickCreateConfig.amEnd}
                    onChange={(e) => setQuickCreateConfig(prev => ({ ...prev, amEnd: e.target.value }))}
                    className="w-16 px-1 py-1 border border-gray-300 rounded text-xs"
                  />
                </div>
                <div>
                  <span className="text-gray-600">오후:</span>
                  <input
                    type="time"
                    value={quickCreateConfig.pmStart}
                    onChange={(e) => setQuickCreateConfig(prev => ({ ...prev, pmStart: e.target.value }))}
                    className="w-16 px-1 py-1 border border-gray-300 rounded text-xs"
                  />
                  <span>-</span>
                  <input
                    type="time"
                    value={quickCreateConfig.pmEnd}
                    onChange={(e) => setQuickCreateConfig(prev => ({ ...prev, pmEnd: e.target.value }))}
                    className="w-16 px-1 py-1 border border-gray-300 rounded text-xs"
                  />
                </div>
              </div>
            </div>
          </div>

          {/* 주간 네비게이션 */}
          <div className="flex items-center justify-between mb-6 p-4 bg-gray-50 rounded-xl">
            <button
              onClick={goToPreviousWeek}
              className="flex items-center px-3 py-2 text-gray-600 hover:text-gray-900 hover:bg-white rounded-lg transition-colors"
            >
              <svg className="w-5 h-5 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
              이전 주
            </button>
            
            <div className="flex items-center space-x-2">
              <h3 className="text-lg font-semibold text-gray-900">
                {currentWeekStart.getFullYear()}년 {currentWeekStart.getMonth() + 1}월 {currentWeekStart.getDate()}일 주간
              </h3>
              <button
                onClick={goToCurrentWeek}
                className="px-3 py-1 text-sm bg-blue-100 text-blue-700 rounded-lg hover:bg-blue-200 transition-colors"
              >
                이번 주
              </button>
            </div>

            <button
              onClick={goToNextWeek}
              className="flex items-center px-3 py-2 text-gray-600 hover:text-gray-900 hover:bg-white rounded-lg transition-colors"
            >
              다음 주
              <svg className="w-5 h-5 ml-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
              </svg>
            </button>
          </div>

          {/* 주간 캘린더 헤더 */}
          <div className="grid grid-cols-7 gap-1 mb-4">
            {['월', '화', '수', '목', '금', '토', '일'].map((day) => (
              <div key={day} className="text-center p-2 text-sm font-medium text-gray-500 bg-gray-50 rounded-lg">
                {day}
              </div>
            ))}
          </div>

          {loading ? (
            <div className="text-center py-8">
              <div className="w-8 h-8 border-4 border-blue-200 border-t-blue-600 rounded-full animate-spin mx-auto mb-4"></div>
              <p className="text-gray-600">로딩 중...</p>
            </div>
          ) : (
            <div className="grid grid-cols-7 gap-1">
              {getWeekDates(currentWeekStart).map((date, index) => {
                const daySlots = getSlotsByDate(date)
                const isToday = date.toDateString() === new Date().toDateString()
                const isPast = date < new Date() && !isToday
                const dateString = date.toISOString().split('T')[0]
                
                return (
                  <div
                    key={index}
                    className={`min-h-96 p-2 border rounded-lg ${
                      isPast ? 'bg-gray-50 opacity-50' : 'bg-white'
                    } ${isToday ? 'border-blue-300 bg-blue-50' : 'border-gray-200'}`}
                  >
                    <div className={`text-sm font-medium mb-3 text-center ${
                      isToday ? 'text-blue-700' : 'text-gray-700'
                    }`}>
                      {formatDateShort(date)}
                    </div>
                    
                    {/* 오전 세션 */}
                    <div className="mb-4">
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-xs font-medium text-orange-600">오전</span>
                        <button
                          onClick={() => createQuickSlots(dateString, 'AM')}
                          className="text-xs bg-orange-100 text-orange-700 px-2 py-1 rounded hover:bg-orange-200 transition-colors"
                        >
                          + 생성
                        </button>
                      </div>
                      <div className="space-y-1 max-h-32 overflow-y-auto">
                        {daySlots.AM.length === 0 ? (
                          <div className="text-xs text-gray-400 text-center py-2">
                            슬롯 없음
                          </div>
                        ) : (
                          daySlots.AM.map((slot) => (
                            <div
                              key={slot.id}
                              className={`p-1 rounded text-xs ${
                                !slot.is_available ? 'bg-gray-200 text-gray-600' :
                                slot.current_reservations > 0 ? 'bg-blue-100 text-blue-800' :
                                'bg-green-100 text-green-800'
                              }`}
                            >
                              <div className="font-medium">
                                {formatTimeSlot(slot.time_slot)}
                              </div>
                              <div className="flex justify-between items-center mt-1">
                                <span>{slot.current_reservations}/{slot.max_capacity}</span>
                                <div className="flex space-x-1">
                                  <button
                                    onClick={() => toggleBreakTime(slot)}
                                    className={`w-4 h-4 rounded text-xs flex items-center justify-center ${
                                      slot.is_available 
                                        ? 'bg-yellow-300 hover:bg-yellow-400' 
                                        : 'bg-green-300 hover:bg-green-400'
                                    }`}
                                    title={slot.is_available ? '쉬는시간 설정' : '예약 가능 설정'}
                                  >
                                    {slot.is_available ? '⏸' : '▶'}
                                  </button>
                                </div>
                              </div>
                              {!slot.is_available && (
                                <div className="text-red-600 text-xs mt-1">쉬는시간</div>
                              )}
                            </div>
                          ))
                        )}
                      </div>
                    </div>

                    {/* 오후 세션 */}
                    <div>
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-xs font-medium text-purple-600">오후</span>
                        <button
                          onClick={() => createQuickSlots(dateString, 'PM')}
                          className="text-xs bg-purple-100 text-purple-700 px-2 py-1 rounded hover:bg-purple-200 transition-colors"
                        >
                          + 생성
                        </button>
                      </div>
                      <div className="space-y-1 max-h-32 overflow-y-auto">
                        {daySlots.PM.length === 0 ? (
                          <div className="text-xs text-gray-400 text-center py-2">
                            슬롯 없음
                          </div>
                        ) : (
                          daySlots.PM.map((slot) => (
                            <div
                              key={slot.id}
                              className={`p-1 rounded text-xs ${
                                !slot.is_available ? 'bg-gray-200 text-gray-600' :
                                slot.current_reservations > 0 ? 'bg-blue-100 text-blue-800' :
                                'bg-green-100 text-green-800'
                              }`}
                            >
                              <div className="font-medium">
                                {formatTimeSlot(slot.time_slot)}
                              </div>
                              <div className="flex justify-between items-center mt-1">
                                <span>{slot.current_reservations}/{slot.max_capacity}</span>
                                <div className="flex space-x-1">
                                  <button
                                    onClick={() => toggleBreakTime(slot)}
                                    className={`w-4 h-4 rounded text-xs flex items-center justify-center ${
                                      slot.is_available 
                                        ? 'bg-yellow-300 hover:bg-yellow-400' 
                                        : 'bg-green-300 hover:bg-green-400'
                                    }`}
                                    title={slot.is_available ? '쉬는시간 설정' : '예약 가능 설정'}
                                  >
                                    {slot.is_available ? '⏸' : '▶'}
                                  </button>
                                </div>
                              </div>
                              {!slot.is_available && (
                                <div className="text-red-600 text-xs mt-1">쉬는시간</div>
                              )}
                            </div>
                          ))
                        )}
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>

        {/* 도움말 */}
        <div className="bg-green-50 border border-green-200 rounded-lg p-4 mt-6">
          <h4 className="font-medium text-green-800 mb-2">사용 안내</h4>
          <div className="text-sm text-green-700 space-y-1">
            <p>• <strong>+ 생성</strong>: 해당 날짜의 오전/오후 전체 시간대에 타임슬롯을 자동으로 생성합니다</p>
            <p>• <strong>⏸ 버튼</strong>: 예약 가능한 슬롯을 쉬는시간으로 변경합니다 (하루 최대 8개)</p>
            <p>• <strong>▶ 버튼</strong>: 쉬는시간을 다시 예약 가능한 상태로 변경합니다</p>
            <p>• 예약이 있는 슬롯은 쉬는시간으로 변경할 수 없습니다</p>
          </div>
        </div>
      </div>
    </div>
  )
}