'use client'

import { useState, useEffect } from 'react'
import { toast } from 'react-hot-toast'
import Link from 'next/link'
import { useRouter } from 'next/navigation'

interface User {
  id: number
  name: string
  className: string
  role: string
}

interface Slot {
  id: number
  date: string
  time_slot: string
  session_period: 'AM' | 'PM'
  teacher_name: string
  max_capacity: number
  current_reservations: number
  is_available: boolean
  available: boolean
}

interface Reservation {
  id: number
  student_id: number
  slot_id: number
  status: string
  problem_selected: boolean
  created_at: string
  updated_at: string
  slot: {
    id: number
    date: string
    time_slot: string
    session_period: 'AM' | 'PM'
    teacher: {
      id: number
      name: string
      class_name: string
    }
  }
  student: {
    id: number
    name: string
    class_name: string
  }
}

interface Problem {
  id: number
  title: string
  limit_minutes: number
  available_date: string
  preview_lead_time: number
  created_at: string
  creator: {
    name: string
    class_name: string
  }
}

interface Session {
  id: number
  status: 'active' | 'feedback_pending' | 'completed'
  date: string
  timeSlot: string
  sessionPeriod: 'AM' | 'PM'
  teacherName: string
  teacherClass: string
  problemTitle: string
  limitMinutes: number
  hasScore: boolean
  finalScore?: number
  hasFeedback: boolean
  hasReflection: boolean
  createdAt: string
  startedAt?: string
}

export default function StudentDashboard() {
  const router = useRouter()
  const [user, setUser] = useState<User | null>(null)
  const [remainingTickets, setRemainingTickets] = useState(0)
  const [slots, setSlots] = useState<Slot[]>([])
  const [reservations, setReservations] = useState<Reservation[]>([])
  const [problems, setProblems] = useState<Problem[]>([])
  const [sessions, setSessions] = useState<Session[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedSlot, setSelectedSlot] = useState<number | null>(null)
  const [currentWeekStart, setCurrentWeekStart] = useState<Date>(new Date())
  const [selectedProblem, setSelectedProblem] = useState<number | null>(null)
  const [showProblemModal, setShowProblemModal] = useState(false)
  const [currentReservationId, setCurrentReservationId] = useState<number | null>(null)
  const [showPinChangeModal, setShowPinChangeModal] = useState(false)
  const [currentPin, setCurrentPin] = useState('')
  const [newPin, setNewPin] = useState('')
  const [pinChangeLoading, setPinChangeLoading] = useState(false)

  // 현재 사용자 정보 조회
  useEffect(() => {
    async function fetchCurrentUser() {
      try {
        const response = await fetch('/api/auth/me')
        const data = await response.json()
        
        if (data.success) {
          setUser(data.user)
          if (data.user.role !== 'student') {
            toast.error('학생만 접근 가능한 페이지입니다.')
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

  // 주간 시작일 계산
  const getWeekStart = (date: Date) => {
    const d = new Date(date)
    const day = d.getDay()
    const diff = d.getDate() - day + (day === 0 ? -6 : 1) // 월요일을 시작으로
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

  // 초기 데이터 로드
  useEffect(() => {
    if (!user) return
    
    // 현재 주의 월요일로 설정
    const weekStart = getWeekStart(new Date())
    setCurrentWeekStart(weekStart)
  }, [user])

  useEffect(() => {
    if (!user || !currentWeekStart) return

    async function loadData() {
      setLoading(true)
      try {
        await Promise.all([
          fetchTickets(),
          fetchWeekSlots(),
          fetchReservations(),
          fetchProblems(), // 초기 로드시에는 모든 문제를 가져옴
          fetchSessions()
        ])
      } catch (error) {
        console.error('데이터 로드 실패:', error)
        toast.error('데이터를 불러오는 중 오류가 발생했습니다.')
      } finally {
        setLoading(false)
      }
    }

    loadData()
  }, [user, currentWeekStart])

  // 이용권 조회
  const fetchTickets = async () => {
    try {
      const response = await fetch('/api/me/tickets')
      const data = await response.json()
      
      if (data.success) {
        setRemainingTickets(data.remaining_tickets)
      }
    } catch (error) {
      console.error('이용권 조회 실패:', error)
    }
  }

  // 주간 슬롯 조회
  const fetchWeekSlots = async () => {
    try {
      const weekEnd = new Date(currentWeekStart)
      weekEnd.setDate(weekEnd.getDate() + 6)
      
      const fromDate = currentWeekStart.toISOString().split('T')[0]
      const toDate = weekEnd.toISOString().split('T')[0]
      
      const response = await fetch(`/api/slots?from=${fromDate}&to=${toDate}`)
      const data = await response.json()
      
      if (data.success) {
        setSlots(data.slots)
      }
    } catch (error) {
      console.error('슬롯 조회 실패:', error)
    }
  }

  // 내 예약 조회
  const fetchReservations = async () => {
    try {
      const response = await fetch('/api/reservations')
      const data = await response.json()
      
      if (data.success) {
        setReservations(data.reservations)
      }
    } catch (error) {
      console.error('예약 조회 실패:', error)
    }
  }

  // 공개된 문제 조회 (특정 날짜 기준)
  const fetchProblems = async (date?: string) => {
    try {
      const url = date ? `/api/student/problems?date=${date}` : '/api/student/problems'
      const response = await fetch(url)
      const data = await response.json()
      
      if (data.success) {
        setProblems(data.problems)
      }
    } catch (error) {
      console.error('문제 조회 실패:', error)
    }
  }

  // 학생 세션 조회
  const fetchSessions = async () => {
    try {
      console.log('Fetching sessions...')
      const response = await fetch('/api/student/sessions')
      const data = await response.json()
      
      console.log('Sessions response:', data)
      
      if (data.success) {
        setSessions(data.sessions || [])
        console.log('Sessions loaded:', data.sessions?.length || 0)
      } else {
        console.error('Sessions fetch failed:', data.error)
      }
    } catch (error) {
      console.error('세션 조회 실패:', error)
    }
  }

  // 예약 생성
  const createReservation = async () => {
    if (!selectedSlot || remainingTickets <= 0) {
      toast.error('슬롯을 선택하고 이용권을 확인해주세요.')
      return
    }

    try {
      const response = await fetch('/api/reservations', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          slotId: selectedSlot
        }),
      })

      const data = await response.json()

      if (data.success) {
        toast.success('예약이 생성되었습니다.')
        setSelectedSlot(null)
        await Promise.all([fetchTickets(), fetchWeekSlots(), fetchReservations()])
      } else {
        toast.error(data.error || '예약 생성에 실패했습니다.')
      }
    } catch (error) {
      console.error('예약 생성 실패:', error)
      toast.error('예약 생성 중 오류가 발생했습니다.')
    }
  }

  // 예약 취소
  const cancelReservation = async (reservationId: number) => {
    if (!confirm('예약을 취소하시겠습니까?')) return

    try {
      const response = await fetch(`/api/reservations/${reservationId}`, {
        method: 'DELETE',
      })

      const data = await response.json()

      if (data.success) {
        toast.success('예약이 취소되고 이용권이 환불되었습니다.')
        await Promise.all([fetchTickets(), fetchWeekSlots(), fetchReservations()])
      } else {
        toast.error(data.error || '예약 취소에 실패했습니다.')
      }
    } catch (error) {
      console.error('예약 취소 실패:', error)
      toast.error('예약 취소 중 오류가 발생했습니다.')
    }
  }

  // 문제 선택
  const selectProblem = async () => {
    if (!selectedProblem || !currentReservationId) {
      toast.error('문제를 선택해주세요.')
      return
    }

    try {
      const response = await fetch(`/api/reservations/${currentReservationId}/select-problem`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          problemId: selectedProblem
        }),
      })

      const data = await response.json()

      if (data.success) {
        toast.success('문제가 선택되고 세션이 생성되었습니다.')
        setShowProblemModal(false)
        setSelectedProblem(null)
        setCurrentReservationId(null)
        
        // 세션 목록 업데이트
        await Promise.all([fetchReservations(), fetchSessions()])
        
        // 세션이 생성되면 피드백 페이지로 이동
        if (data.session?.id || data.sessionId) {
          const sessionId = data.session?.id || data.sessionId
          router.push(`/session/${sessionId}/feedback`)
        }
      } else {
        toast.error(data.error || '문제 선택에 실패했습니다.')
      }
    } catch (error) {
      console.error('문제 선택 실패:', error)
      toast.error('문제 선택 중 오류가 발생했습니다.')
    }
  }

  // 당일 예약인지 확인
  const isTodayReservation = (reservation: Reservation) => {
    const today = new Date().toISOString().split('T')[0]
    return reservation.slot.date === today
  }

  // PIN 변경
  const changePin = async () => {
    if (!currentPin || !newPin) {
      toast.error('현재 PIN과 새 PIN을 모두 입력해주세요.')
      return
    }

    if (newPin.length !== 4 || !/^\d{4}$/.test(newPin)) {
      toast.error('새 PIN은 4자리 숫자여야 합니다.')
      return
    }

    setPinChangeLoading(true)

    try {
      const response = await fetch('/api/change-pin', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          currentPin,
          newPin
        }),
      })

      const data = await response.json()

      if (data.success) {
        toast.success('PIN이 성공적으로 변경되었습니다.')
        setShowPinChangeModal(false)
        setCurrentPin('')
        setNewPin('')
      } else {
        toast.error(data.error || 'PIN 변경에 실패했습니다.')
      }
    } catch (error) {
      console.error('PIN 변경 실패:', error)
      toast.error('PIN 변경 중 오류가 발생했습니다.')
    } finally {
      setPinChangeLoading(false)
    }
  }

  // 날짜 포맷팅
  const formatDate = (dateString: string) => {
    const date = new Date(dateString)
    return date.toLocaleDateString('ko-KR', {
      month: 'long',
      day: 'numeric',
      weekday: 'short'
    })
  }

  // 시간 포맷팅
  const formatTimeSlot = (timeSlot: string) => {
    return timeSlot // "10:00", "10:10" 등 그대로 표시
  }

  // 세션 구분 한글 변환
  const getSessionLabel = (period: 'AM' | 'PM') => {
    return period === 'AM' ? '오전' : '오후'
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

  // 날짜별 슬롯 그룹핑
  const getSlotsByDate = (date: Date) => {
    const dateString = date.toISOString().split('T')[0]
    return slots.filter(slot => slot.date === dateString && slot.available)
  }

  // 날짜 포맷팅 (간단)
  const formatDateShort = (date: Date) => {
    const month = date.getMonth() + 1
    const day = date.getDate()
    const weekday = ['일', '월', '화', '수', '목', '금', '토'][date.getDay()]
    return `${month}/${day} (${weekday})`
  }

  if (loading) {
    return (
      <div className="min-h-screen gradient-bg flex items-center justify-center">
        <div className="text-center animate-fade-in">
          <div className="w-12 h-12 border-4 border-blue-200 border-t-blue-600 rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-gray-600 font-medium">데이터를 불러오는 중...</p>
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
              <div className="w-8 h-8 bg-blue-600 rounded-xl flex items-center justify-center">
                <span className="text-white font-bold text-sm">L</span>
              </div>
              <div>
                <span className="text-lg font-bold text-gray-900">Last Days</span>
                <p className="text-sm text-gray-600">학생 대시보드</p>
              </div>
            </div>
            <div className="flex items-center space-x-4">
              <Link 
                href="/dashboard/student/history"
                className="btn-ghost"
              >
                학습 히스토리
              </Link>
              <button
                onClick={() => setShowPinChangeModal(true)}
                className="btn-ghost"
              >
                PIN 변경
              </button>
              <div className="flex items-center space-x-3 px-4 py-2 bg-blue-50 rounded-xl border border-blue-100">
                <div className="w-2 h-2 bg-blue-500 rounded-full animate-pulse"></div>
                <div className="text-sm">
                  <span className="text-blue-600 font-medium">보유 이용권</span>
                  <span className="ml-2 text-2xl font-bold text-blue-700">{remainingTickets}</span>
                  <span className="text-blue-600 text-sm">장</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </nav>

      <div className="max-w-7xl mx-auto px-6 py-8">
        {/* Welcome Header */}
        <div className="mb-8 animate-fade-in">
          <h1 className="text-4xl font-bold text-gray-900 mb-2">
            안녕하세요, <span className="bg-gradient-to-r from-blue-600 to-blue-600 bg-clip-text text-transparent">{user?.name}</span>님!
          </h1>
          <p className="text-xl text-gray-600">{user?.className} • 체계적인 학습으로 목표를 달성해보세요</p>
        </div>

        {/* 통합 예약 캘린더 */}
        <div className="card animate-slide-up">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-3xl font-bold text-gray-900">예약 캘린더</h2>
            <div className="w-12 h-12 bg-blue-100 rounded-xl flex items-center justify-center">
              <svg className="w-6 h-6 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
              </svg>
            </div>
          </div>

          {/* 주간 네비게이션 */}
          <div className="flex items-center justify-between mb-8 p-4 bg-gradient-to-r from-gray-50 to-blue-50 rounded-xl border border-gray-200">
            <button
              onClick={goToPreviousWeek}
              className="flex items-center px-4 py-2 text-gray-600 hover:text-gray-900 hover:bg-white rounded-lg transition-all shadow-sm hover:shadow-md"
            >
              <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
              이전 주
            </button>
            
            <div className="flex items-center space-x-3">
              <h3 className="text-xl font-bold text-gray-900">
                {currentWeekStart.getFullYear()}년 {currentWeekStart.getMonth() + 1}월 {currentWeekStart.getDate()}일 주간
              </h3>
              <button
                onClick={goToCurrentWeek}
                className="px-4 py-2 text-sm bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors shadow-sm"
              >
                이번 주
              </button>
            </div>

            <button
              onClick={goToNextWeek}
              className="flex items-center px-4 py-2 text-gray-600 hover:text-gray-900 hover:bg-white rounded-lg transition-all shadow-sm hover:shadow-md"
            >
              다음 주
              <svg className="w-5 h-5 ml-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
              </svg>
            </button>
          </div>

          {/* 내 예약 요약 */}
          {reservations.length > 0 && (
            <div className="mb-8 p-6 bg-gradient-to-br from-blue-50 to-indigo-50 rounded-2xl border border-blue-200">
              <h3 className="text-lg font-bold text-gray-900 mb-4 flex items-center">
                <div className="w-8 h-8 bg-blue-500 rounded-lg flex items-center justify-center mr-3">
                  <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                </div>
                내 예약 현황 ({reservations.length}개)
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {reservations.map((reservation) => (
                  <div
                    key={reservation.id}
                    className={`p-4 rounded-xl border-2 transition-all duration-200 ${
                      reservation.status === 'completed' ? 'bg-green-50 border-green-200' :
                      reservation.problem_selected ? 'bg-blue-50 border-blue-200' :
                      isTodayReservation(reservation) ? 'bg-amber-50 border-amber-200' :
                      'bg-white border-gray-200'
                    }`}
                  >
                    <div className="flex justify-between items-start mb-3">
                      <div>
                        <p className="font-semibold text-gray-800 text-sm">
                          {formatDate(reservation.slot.date)}
                        </p>
                        <p className="text-gray-600 text-sm">
                          {getSessionLabel(reservation.slot.session_period)} {formatTimeSlot(reservation.slot.time_slot)}
                        </p>
                        <p className="text-gray-500 text-xs">
                          {reservation.slot.teacher.name} 선생님
                        </p>
                      </div>
                      <span className={`px-2 py-1 rounded-lg text-xs font-medium ${
                        reservation.status === 'completed' ? 'bg-green-100 text-green-800' :
                        reservation.problem_selected ? 'bg-blue-100 text-blue-800' :
                        'bg-yellow-100 text-yellow-800'
                      }`}>
                        {reservation.status === 'completed' ? '완료' :
                         reservation.problem_selected ? '문제선택완료' : '예약됨'}
                      </span>
                    </div>
                    <div className="flex space-x-2">
                      {isTodayReservation(reservation) && !reservation.problem_selected && (
                        <button
                          onClick={async () => {
                            setCurrentReservationId(reservation.id)
                            // 해당 예약 날짜에 맞는 문제들만 가져오기
                            await fetchProblems(reservation.slot.date)
                            setShowProblemModal(true)
                          }}
                          className="flex-1 btn-primary text-xs py-2"
                        >
                          문제 선택
                        </button>
                      )}
                      {reservation.status === 'active' && (
                        <button
                          onClick={() => cancelReservation(reservation.id)}
                          className="flex-1 px-3 py-2 bg-red-500 text-white text-xs rounded-lg font-medium hover:bg-red-600 transition-colors"
                        >
                          취소
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* 주간 캘린더 그리드 - 더 큰 사이즈 */}
          <div className="grid grid-cols-7 gap-2 mb-6">
            {['월요일', '화요일', '수요일', '목요일', '금요일', '토요일', '일요일'].map((day, index) => (
              <div key={day} className="text-center p-4 text-lg font-bold text-gray-700 bg-gradient-to-br from-gray-50 to-gray-100 rounded-xl border border-gray-200">
                {day}
              </div>
            ))}
          </div>

          <div className="grid grid-cols-7 gap-2 max-h-[600px] overflow-y-auto custom-scrollbar">
            {getWeekDates(currentWeekStart).map((date, index) => {
              const daySlots = getSlotsByDate(date)
              const dayReservations = reservations.filter(res => res.slot.date === date.toISOString().split('T')[0])
              const isToday = date.toDateString() === new Date().toDateString()
              const isPast = date < new Date() && !isToday
              
              return (
                <div
                  key={index}
                  className={`min-h-48 p-4 border-2 rounded-2xl transition-all duration-200 ${
                    isPast ? 'bg-gray-50 opacity-60' : 'bg-white hover:shadow-md'
                  } ${isToday ? 'border-blue-400 bg-blue-50 shadow-lg' : 'border-gray-200'}`}
                >
                  <div className={`text-lg font-bold mb-4 text-center pb-2 border-b ${
                    isToday ? 'text-blue-700 border-blue-200' : 'text-gray-700 border-gray-200'
                  }`}>
                    {formatDateShort(date)}
                    {isToday && <div className="text-xs text-blue-600 font-normal">오늘</div>}
                  </div>
                  
                  {/* 내 예약 표시 */}
                  {dayReservations.map((reservation) => (
                    <div
                      key={`reservation-${reservation.id}`}
                      className={`mb-3 p-3 rounded-xl border-2 ${
                        reservation.status === 'completed' ? 'bg-green-100 border-green-300' :
                        reservation.problem_selected ? 'bg-blue-100 border-blue-300' :
                        'bg-amber-100 border-amber-300'
                      }`}
                    >
                      <div className="text-sm font-semibold text-gray-800">
                        내 예약 📅
                      </div>
                      <div className="text-sm text-gray-600">
                        {getSessionLabel(reservation.slot.session_period)} {formatTimeSlot(reservation.slot.time_slot)}
                      </div>
                      <div className="text-xs text-gray-500">
                        {reservation.slot.teacher.name} 선생님
                      </div>
                    </div>
                  ))}
                  
                  {/* 예약 가능한 슬롯 표시 */}
                  {daySlots.length === 0 && dayReservations.length === 0 ? (
                    <div className="text-center mt-8">
                      <div className="w-12 h-12 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-2">
                        <svg className="w-6 h-6 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                        </svg>
                      </div>
                      <div className="text-sm text-gray-400">
                        {isPast ? '지난 날' : '예약 없음'}
                      </div>
                    </div>
                  ) : (
                    <div className="space-y-2">
                      {daySlots.map((slot) => (
                        <div
                          key={slot.id}
                          className={`p-3 rounded-xl cursor-pointer transition-all duration-200 border-2 ${
                            selectedSlot === slot.id
                              ? 'bg-green-100 border-green-400 shadow-md scale-105'
                              : 'bg-gray-50 hover:bg-gray-100 border-gray-200 hover:border-gray-300 hover:shadow-sm'
                          } ${isPast ? 'cursor-not-allowed opacity-50' : ''}`}
                          onClick={() => !isPast && setSelectedSlot(slot.id)}
                        >
                          <div className="font-semibold text-gray-800 text-sm">
                            {getSessionLabel(slot.session_period)} {formatTimeSlot(slot.time_slot)}
                          </div>
                          <div className="text-gray-600 text-sm truncate">
                            {slot.teacher_name} 선생님
                          </div>
                          <div className="text-gray-500 text-xs">
                            {slot.current_reservations}/{slot.max_capacity}명
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )
            })}
          </div>

          {/* 예약하기 버튼 */}
          <div className="mt-8 pt-6 border-t-2 border-gray-200">
            <button
              onClick={createReservation}
              disabled={!selectedSlot || remainingTickets <= 0}
              className={`w-full py-6 px-8 rounded-2xl font-bold text-xl transition-all duration-300 ${
                selectedSlot && remainingTickets > 0
                  ? 'bg-gradient-to-r from-blue-600 to-blue-700 text-white shadow-xl hover:shadow-2xl transform hover:-translate-y-2 hover:scale-105'
                  : 'bg-gray-200 text-gray-500 cursor-not-allowed'
              }`}
            >
              {remainingTickets <= 0 ? '이용권이 없습니다 😔' : 
               selectedSlot ? '선택한 시간으로 예약하기 ✨' : '시간을 선택해주세요 📅'}
            </button>
          </div>
        </div>

        {/* 피드백 세션 현황 */}
        <div className="card animate-slide-up">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-3xl font-bold text-gray-900">피드백 세션</h2>
            <div className="w-12 h-12 bg-green-100 rounded-xl flex items-center justify-center">
              <svg className="w-6 h-6 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
            </div>
          </div>

          {sessions.length === 0 ? (
            <div className="text-center py-12">
              <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <svg className="w-8 h-8 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
              </div>
              <h3 className="text-lg font-medium text-gray-600 mb-2">생성된 피드백 세션이 없습니다</h3>
              <p className="text-gray-500">문제를 선택하면 피드백 세션이 생성됩니다</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {sessions.map((session) => (
                <div
                  key={session.id}
                  className={`p-5 rounded-2xl border-2 transition-all duration-200 hover:shadow-lg ${
                    session.status === 'completed' ? 'bg-green-50 border-green-200' :
                    session.status === 'feedback_pending' ? 'bg-blue-50 border-blue-200' :
                    'bg-amber-50 border-amber-200'
                  }`}
                >
                  <div className="flex justify-between items-start mb-3">
                    <div className="flex-1">
                      <h3 className="font-semibold text-gray-800 truncate">
                        {session.problemTitle}
                      </h3>
                      <p className="text-sm text-gray-600 mt-1">
                        {formatDate(session.date)} • {getSessionLabel(session.sessionPeriod)} {formatTimeSlot(session.timeSlot)}
                      </p>
                      <p className="text-xs text-gray-500">
                        {session.teacherName} 선생님 • {session.limitMinutes}분
                      </p>
                    </div>
                    <span className={`px-2 py-1 rounded-lg text-xs font-medium ${
                      session.status === 'completed' ? 'bg-green-100 text-green-800' :
                      session.status === 'feedback_pending' ? 'bg-blue-100 text-blue-800' :
                      'bg-amber-100 text-amber-800'
                    }`}>
                      {session.status === 'completed' ? '완료' :
                       session.status === 'feedback_pending' ? '피드백 대기' : '진행중'}
                    </span>
                  </div>

                  {/* 진행 상황 표시 */}
                  <div className="mb-4 space-y-2">
                    <div className="flex items-center text-xs">
                      <div className={`w-3 h-3 rounded-full mr-2 ${session.hasScore ? 'bg-green-500' : 'bg-gray-300'}`}></div>
                      <span className={session.hasScore ? 'text-green-700' : 'text-gray-500'}>
                        채점 {session.hasScore ? '완료' : '대기중'}
                      </span>
                      {session.hasScore && session.finalScore !== null && (
                        <span className="ml-2 font-medium text-green-700">({session.finalScore}점)</span>
                      )}
                    </div>
                    <div className="flex items-center text-xs">
                      <div className={`w-3 h-3 rounded-full mr-2 ${session.hasFeedback ? 'bg-green-500' : 'bg-gray-300'}`}></div>
                      <span className={session.hasFeedback ? 'text-green-700' : 'text-gray-500'}>
                        피드백 {session.hasFeedback ? '완료' : '대기중'}
                      </span>
                    </div>
                    <div className="flex items-center text-xs">
                      <div className={`w-3 h-3 rounded-full mr-2 ${session.hasReflection ? 'bg-green-500' : 'bg-gray-300'}`}></div>
                      <span className={session.hasReflection ? 'text-green-700' : 'text-gray-500'}>
                        복기 {session.hasReflection ? '완료' : '작성중'}
                      </span>
                    </div>
                  </div>

                  {/* 피드백 페이지 이동 버튼 */}
                  <button
                    onClick={() => {
                      console.log('피드백 페이지로 이동:', `/session/${session.id}/feedback`)
                      console.log('세션 ID:', session.id)
                      router.push(`/session/${session.id}/feedback`)
                    }}
                    className="w-full py-3 px-4 bg-white border border-gray-300 rounded-xl text-gray-700 font-medium hover:bg-gray-50 hover:border-gray-400 transition-all duration-200"
                  >
                    피드백 페이지 보기 →
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* 문제 선택 모달 */}
        {showProblemModal && (
          <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 px-4">
            <div className="bg-white rounded-3xl p-8 w-full max-w-2xl shadow-2xl animate-slide-up">
              <div className="flex items-center justify-between mb-6">
                <h3 className="text-2xl font-bold text-gray-900">문제 선택</h3>
                <div className="w-10 h-10 bg-blue-100 rounded-xl flex items-center justify-center">
                  <svg className="w-5 h-5 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                  </svg>
                </div>
              </div>
              <div className="max-h-80 overflow-y-auto custom-scrollbar mb-8">
                <div className="space-y-4">
                  {problems.length === 0 ? (
                    <div className="text-center py-8">
                      <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
                        <svg className="w-8 h-8 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                        </svg>
                      </div>
                      <p className="text-gray-500 text-lg">사용 가능한 문제가 없습니다</p>
                    </div>
                  ) : (
                    problems.map((problem) => (
                      <div
                        key={problem.id}
                        className={`p-5 rounded-2xl border-2 cursor-pointer transition-all duration-200 ${
                          selectedProblem === problem.id
                            ? 'bg-gradient-to-br from-blue-50 to-blue-50 border-blue-300 shadow-medium scale-[1.02]'
                            : 'bg-white border-gray-200 hover:border-gray-300 hover:shadow-soft hover:scale-[1.01]'
                        }`}
                        onClick={() => setSelectedProblem(problem.id)}
                      >
                      <div className="flex justify-between items-start">
                        <div className="flex-1">
                          <p className="font-medium text-gray-800">{problem.title}</p>
                          <div className="flex items-center mt-2 space-x-2">
                            <span className="px-2 py-1 bg-blue-100 text-blue-700 text-xs rounded">
                              제한시간 {problem.limit_minutes}분
                            </span>
                            <span className="px-2 py-1 bg-green-100 text-green-700 text-xs rounded">
                              사전열람 {problem.preview_lead_time}분 전
                            </span>
                          </div>
                          <div className="mt-1 text-xs text-gray-500">
                            {problem.creator.name} 선생님 • {problem.creator.class_name}
                          </div>
                        </div>
                        <input
                          type="radio"
                          name="problem"
                          checked={selectedProblem === problem.id}
                          onChange={() => setSelectedProblem(problem.id)}
                          className="h-4 w-4 text-blue-600"
                        />
                      </div>
                    </div>
                  ))
                  )}
                </div>
              </div>
              <div className="flex space-x-4">
                <button
                  onClick={() => {
                    setShowProblemModal(false)
                    setSelectedProblem(null)
                    setCurrentReservationId(null)
                  }}
                  className="btn-secondary flex-1 py-3"
                >
                  취소
                </button>
                <button
                  onClick={selectProblem}
                  disabled={!selectedProblem}
                  className={`flex-1 py-3 px-6 rounded-2xl font-semibold transition-all duration-200 ${
                    selectedProblem
                      ? 'bg-blue-600 text-white shadow-medium hover:bg-blue-700 hover:shadow-lg transform hover:-translate-y-0.5'
                      : 'bg-gray-200 text-gray-500 cursor-not-allowed'
                  }`}
                >
                  선택하기 ✨
                </button>
              </div>
            </div>
          </div>
        )}

        {/* PIN 변경 모달 */}
        {showPinChangeModal && (
          <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 px-4">
            <div className="bg-white rounded-3xl p-8 w-full max-w-md shadow-2xl animate-slide-up">
              <div className="flex items-center justify-between mb-6">
                <h3 className="text-2xl font-bold text-gray-900">PIN 변경</h3>
                <div className="w-10 h-10 bg-blue-100 rounded-xl flex items-center justify-center">
                  <svg className="w-5 h-5 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 7a2 2 0 012 2m0 0a2 2 0 012 2m-2-2a2 2 0 00-2 2m2 2v2a2 2 0 01-2 2m-2-2a2 2 0 01-2-2m2-2a2 2 0 012-2m0 0V5a2 2 0 00-2-2m-4 6V4a1 1 0 011-1h4a1 1 0 011 1v2m-6 0a1 1 0 00-1 1v4a1 1 0 001 1m-1-5h2m5 0h2" />
                  </svg>
                </div>
              </div>

              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    현재 PIN
                  </label>
                  <input
                    type="password"
                    maxLength={4}
                    value={currentPin}
                    onChange={(e) => setCurrentPin(e.target.value.replace(/[^0-9]/g, ''))}
                    placeholder="현재 4자리 PIN 입력"
                    className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all text-center text-lg font-mono"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    새로운 PIN
                  </label>
                  <input
                    type="password"
                    maxLength={4}
                    value={newPin}
                    onChange={(e) => setNewPin(e.target.value.replace(/[^0-9]/g, ''))}
                    placeholder="새로운 4자리 PIN 입력"
                    className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all text-center text-lg font-mono"
                  />
                </div>

                <div className="text-sm text-gray-500 p-3 bg-yellow-50 rounded-lg border border-yellow-200">
                  <p className="flex items-center">
                    <svg className="w-4 h-4 text-yellow-600 mr-2 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.876c1.242 0 2.135-1.13 1.73-2.261L13.956 4.016a1.969 1.969 0 00-3.913 0L3.332 16.739C2.927 17.87 3.82 19 5.062 19z" />
                    </svg>
                    PIN은 4자리 숫자여야 하며, 동일한 이름+PIN 조합이 없어야 합니다.
                  </p>
                </div>
              </div>

              <div className="flex space-x-4 mt-8">
                <button
                  onClick={() => {
                    setShowPinChangeModal(false)
                    setCurrentPin('')
                    setNewPin('')
                  }}
                  className="btn-secondary flex-1 py-3"
                  disabled={pinChangeLoading}
                >
                  취소
                </button>
                <button
                  onClick={changePin}
                  disabled={!currentPin || !newPin || currentPin.length !== 4 || newPin.length !== 4 || pinChangeLoading}
                  className={`flex-1 py-3 px-6 rounded-2xl font-semibold transition-all duration-200 ${
                    currentPin && newPin && currentPin.length === 4 && newPin.length === 4 && !pinChangeLoading
                      ? 'bg-blue-600 text-white shadow-medium hover:bg-blue-700 hover:shadow-lg transform hover:-translate-y-0.5'
                      : 'bg-gray-200 text-gray-500 cursor-not-allowed'
                  }`}
                >
                  {pinChangeLoading ? (
                    <div className="flex items-center justify-center">
                      <div className="w-5 h-5 border-2 border-gray-400 border-t-white rounded-full animate-spin mr-2"></div>
                      변경 중...
                    </div>
                  ) : (
                    'PIN 변경'
                  )}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}