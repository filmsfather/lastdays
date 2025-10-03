'use client'

import { useState, useEffect } from 'react'
import { toast } from 'react-hot-toast'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { getKoreanDate, toKoreanDateString } from '@/lib/dateUtils'

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

interface Announcement {
  id: number
  title: string
  content: string
  created_at: string
  updated_at: string
  creator_name: string
  creator_class: string
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
  const [showDatePicker, setShowDatePicker] = useState(false)
  const [selectedDayFilter, setSelectedDayFilter] = useState<number | null>(null) // 0=일요일, 1=월요일, ..., 6=토요일
  const [announcements, setAnnouncements] = useState<Announcement[]>([])
  const [announcementsLoading, setAnnouncementsLoading] = useState(false)
  const [showSpecialLecture, setShowSpecialLecture] = useState(false)

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

  // 한국 시간 기준으로 주간 시작일 계산
  const getWeekStart = (date?: Date) => {
    // 한국 시간 기준으로 날짜 가져오기
    const targetDate = date ?? getKoreanDate()
    const koreanDateString = toKoreanDateString(targetDate as Date)
    const [year, month, day] = koreanDateString.split('-').map(Number)
    const koreanDate = new Date(year, month - 1, day) // 한국 시간대 기준 Date 객체
    
    const dayOfWeek = koreanDate.getDay()
    const diff = koreanDate.getDate() - dayOfWeek + (dayOfWeek === 0 ? -6 : 1) // 월요일을 시작으로
    
    const weekStart = new Date(koreanDate)
    weekStart.setDate(diff)
    return weekStart
  }

  // 주간 날짜 배열 생성 (한국 시간 기준)
  const getWeekDates = (weekStart: Date) => {
    const dates = []
    for (let i = 0; i < 7; i++) {
      const date = new Date(weekStart)
      date.setDate(weekStart.getDate() + i)
      dates.push(date)
    }
    return dates
  }

  // Date 객체를 YYYY-MM-DD 문자열로 변환
  const formatDateString = (date: Date) => {
    const year = date.getFullYear()
    const month = String(date.getMonth() + 1).padStart(2, '0')
    const day = String(date.getDate()).padStart(2, '0')
    return `${year}-${month}-${day}`
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
          fetchSessions(),
          fetchAnnouncements()
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
      
      const fromDate = toKoreanDateString(currentWeekStart)
      const toDate = toKoreanDateString(weekEnd)
      
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
        // 예약을 슬롯의 날짜와 시간순으로 정렬 (빠른 날짜/시간 먼저)
        const sortedReservations = (data.reservations || []).sort((a: Reservation, b: Reservation) => {
          // 1. 날짜 비교 (빠른 날짜 먼저)
          const dateA = new Date(a.slot.date).getTime()
          const dateB = new Date(b.slot.date).getTime()
          if (dateA !== dateB) {
            return dateA - dateB
          }
          
          // 2. 같은 날짜면 시간 비교 (빠른 시간 먼저)
          const timeA = a.slot.time_slot
          const timeB = b.slot.time_slot
          return timeA.localeCompare(timeB)
        })
        
        setReservations(sortedReservations)
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

  // 공지사항 조회
  const fetchAnnouncements = async () => {
    try {
      setAnnouncementsLoading(true)
      const response = await fetch('/api/announcements')
      const data = await response.json()
      
      if (data.success) {
        setAnnouncements(data.announcements || [])
      } else {
        console.error('Failed to fetch announcements:', data.error)
      }
    } catch (error) {
      console.error('Error fetching announcements:', error)
    } finally {
      setAnnouncementsLoading(false)
    }
  }

  // 예약 생성
  const createReservation = async (type: 'normal' | 'essay' = 'normal') => {
    const requiredTickets = type === 'essay' ? 2 : 1
    
    if (!selectedSlot || remainingTickets < requiredTickets) {
      const message = type === 'essay' 
        ? '작법 예약을 위해서는 이용권이 2장 필요합니다.' 
        : '슬롯을 선택하고 이용권을 확인해주세요.'
      toast.error(message)
      return
    }

    try {
      const response = await fetch('/api/reservations', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          slotId: selectedSlot,
          type
        }),
      })

      const data = await response.json()

      if (data.success) {
        const successMessage = type === 'essay' 
          ? '작법 예약이 성공적으로 생성되었습니다!' 
          : '예약이 생성되었습니다.'
        toast.success(successMessage)
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
    try {
      // 첫 번째 시도 - 일반 취소 (body 없음)
      const response = await fetch(`/api/reservations/${reservationId}`, {
        method: 'DELETE',
      })

      const data = await response.json()

      if (data.success) {
        // 성공한 경우
        toast.success(data.message || '예약이 취소되었습니다.')
        await Promise.all([fetchTickets(), fetchWeekSlots(), fetchReservations()])
      } else if (data.error === 'late_cancellation_warning' && data.needsConfirmation) {
        // 3시간 후 취소 경고 - 사용자 확인 필요
        const userConfirmed = confirm(data.message)
        
        if (userConfirmed) {
          // 사용자가 확인한 경우 - 환불 없이 취소 진행
          await handleLateCancellation(reservationId)
        }
      } else {
        // 기타 오류
        toast.error(data.error || '예약 취소에 실패했습니다.')
      }
    } catch (error) {
      console.error('예약 취소 실패:', error)
      toast.error('예약 취소 중 오류가 발생했습니다.')
    }
  }

  // 3시간 후 취소 처리 (환불 없음)
  const handleLateCancellation = async (reservationId: number) => {
    try {
      const response = await fetch(`/api/reservations/${reservationId}`, {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          confirmLateCancel: true
        })
      })

      const data = await response.json()

      if (data.success) {
        toast.success(data.message || '예약이 취소되었습니다.')
        await Promise.all([fetchTickets(), fetchWeekSlots(), fetchReservations()])
      } else {
        toast.error(data.error || '예약 취소에 실패했습니다.')
      }
    } catch (error) {
      console.error('늦은 취소 실패:', error)
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
      console.log('문제 선택 요청:', { currentReservationId, selectedProblem })
      
      const response = await fetch(`/api/reservations/${currentReservationId}/select-problem`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          problemId: selectedProblem
        }),
      })

      console.log('API 응답 상태:', response.status, response.statusText)
      console.log('API 응답 헤더:', Object.fromEntries(response.headers.entries()))

      if (!response.ok) {
        console.error('API 에러 응답:', response.status, response.statusText)
        
        // 405 에러인 경우 특별 처리
        if (response.status === 405) {
          toast.error('API 경로 오류가 발생했습니다. 개발자에게 문의하세요.')
          return
        }
        
        // 응답이 JSON이 아닐 수도 있으므로 텍스트로 먼저 읽기
        const errorText = await response.text()
        console.error('에러 응답 내용:', errorText)
        
        try {
          const errorData = JSON.parse(errorText)
          toast.error(errorData.error || '문제 선택에 실패했습니다.')
        } catch (parseError) {
          toast.error(`서버 오류 (${response.status}): ${errorText || '알 수 없는 오류'}`)
        }
        return
      }

      const data = await response.json()
      console.log('API 응답 데이터:', data)

      if (data.success) {
        toast.success('문제가 선택되고 세션이 생성되었습니다.')
        setShowProblemModal(false)
        setSelectedProblem(null)
        setCurrentReservationId(null)
        
        // 세션 목록 업데이트
        await Promise.all([fetchReservations(), fetchSessions()])
      } else {
        toast.error(data.error || '문제 선택에 실패했습니다.')
      }
    } catch (error) {
      console.error('문제 선택 실패 (Catch):', error)
      toast.error(`문제 선택 중 오류가 발생했습니다: ${error instanceof Error ? error.message : '알 수 없는 오류'}`)
    }
  }

  // 한국 시간대 기준으로 오늘 날짜 가져오기
  const getKoreanDate = (date?: Date) => {
    const now = date || new Date()
    // 한국 시간대로 변환하여 YYYY-MM-DD 형태로 반환
    const koreanTime = new Intl.DateTimeFormat('fr-CA', { 
      timeZone: 'Asia/Seoul' 
    }).format(now)
    return koreanTime // YYYY-MM-DD 형태
  }

  // 특강 메뉴 외부 클릭 감지
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as Element
      if (!target.closest('.special-lecture-dropdown')) {
        setShowSpecialLecture(false)
      }
    }

    if (showSpecialLecture) {
      document.addEventListener('mousedown', handleClickOutside)
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
    }
  }, [showSpecialLecture])

  // 이미지/시나리오 분석 페이지로 이동
  const goToImageAnalysis = () => {
    window.open('https://youtube.com/live/dzDsF2bpkmU?feature=share', '_blank')
    setShowSpecialLecture(false)
  }
  // 성결대 특강 페이지로 이동
  const goToSungkyulLecture = () => {
    window.open('https://youtube.com/live/ukS-PMccU3U?feature=share', '_blank')
    setShowSpecialLecture(false)
  }
  // 성결대 로그라인 페이지로 이동
  const goToSungkyulLogline = () => {
    window.open('https://youtube.com/live/2Nuo-0vp9ug?feature=share', '_blank')
    setShowSpecialLecture(false)
  }

  // 당일 또는 미래 예약인지 확인
  const isFutureOrTodayReservation = (reservation: Reservation) => {
    const today = getKoreanDate()
    return reservation.slot.date >= today
  }

  // 과거 예약인지 확인
  const isPastReservation = (reservation: Reservation) => {
    const today = getKoreanDate()
    return reservation.slot.date < today
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

  // 시간 포맷팅 (초 제거)
  const formatTimeSlot = (timeSlot: string) => {
    // "10:00:00" -> "10:00", "10:10:30" -> "10:10"
    return timeSlot.substring(0, 5)
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

  const goToSpecificDate = (date: Date) => {
    const weekStart = getWeekStart(date)
    setCurrentWeekStart(weekStart)
    setShowDatePicker(false)
  }

  // 날짜별 슬롯 그룹핑 (한국 시간 기준)
  const getSlotsByDate = (date: Date) => {
    const dateString = formatDateString(date)
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
        <div className="max-w-7xl mx-auto px-4 lg:px-6 py-4">
          <div className="flex justify-between items-center">
            <div className="flex items-center space-x-3">
              <div className="w-8 h-8 bg-blue-600 rounded-xl flex items-center justify-center">
                <span className="text-white font-bold text-sm">L</span>
              </div>
              <div className="hidden sm:block">
                <span className="text-lg font-bold text-gray-900">Last Days</span>
                <p className="text-sm text-gray-600">학생 대시보드</p>
              </div>
              <div className="sm:hidden">
                <span className="text-base font-bold text-gray-900">Last Days</span>
              </div>
            </div>
            
            {/* 데스크톱 메뉴 */}
            <div className="hidden md:flex items-center space-x-4">
              <Link 
                href="/dashboard/student/history"
                className="btn-ghost"
              >
                학습 히스토리
              </Link>
              
              {/* 특강 드롭다운 메뉴 */}
              <div className="relative special-lecture-dropdown">
                <button
                  onClick={() => setShowSpecialLecture(!showSpecialLecture)}
                  className="btn-ghost flex items-center"
                >
                  특강
                  <svg 
                    className={`ml-1 w-4 h-4 transition-transform duration-200 ${showSpecialLecture ? 'rotate-180' : ''}`} 
                    fill="none" stroke="currentColor" viewBox="0 0 24 24"
                  >
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                  </svg>
                </button>
                
                {/* 드롭다운 메뉴 */}
                {showSpecialLecture && (
                  <div className="absolute top-full left-0 mt-2 w-56 bg-white rounded-xl shadow-lg border border-gray-200 py-2 z-50 animate-fade-in">
                    <button
                      onClick={goToImageAnalysis}
                      className="w-full px-4 py-3 text-left hover:bg-gray-50 transition-colors flex items-center"
                    >
                      <div className="w-8 h-8 bg-blue-100 rounded-lg flex items-center justify-center mr-3">
                        <svg className="w-4 h-4 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                        </svg>
                      </div>
                      <div>
                        <div className="font-medium text-gray-900">이미지/시나리오 분석</div>
                      </div>
                    </button>
                    <button
                      onClick={goToSungkyulLecture}
                      className="w-full px-4 py-3 text-left hover:bg-gray-50 transition-colors flex items-center"
                    >
                      <div className="w-8 h-8 bg-purple-100 rounded-lg flex items-center justify-center mr-3">
                        <svg className="w-4 h-4 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                        </svg>
                      </div>
                      <div>
                        <div className="font-medium text-gray-900">성결대 특강</div>
                      </div>
                    </button>
                    <button
                      onClick={goToSungkyulLogline}
                      className="w-full px-4 py-3 text-left hover:bg-gray-50 transition-colors flex items-center"
                    >
                      <div className="w-8 h-8 bg-green-100 rounded-lg flex items-center justify-center mr-3">
                        <svg className="w-4 h-4 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v6a2 2 0 002 2h6a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01" />
                        </svg>
                      </div>
                      <div>
                        <div className="font-medium text-gray-900">성결대 로그라인</div>
                      </div>
                    </button>
                  </div>
                )}
              </div>
              
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

            {/* 모바일 메뉴 */}
            <div className="md:hidden flex items-center space-x-2">
              <div className="flex items-center px-3 py-1 bg-blue-50 rounded-lg border border-blue-100">
                <div className="w-2 h-2 bg-blue-500 rounded-full animate-pulse mr-2"></div>
                <span className="text-blue-700 font-bold text-lg">{remainingTickets}</span>
                <span className="text-blue-600 text-xs ml-1">장</span>
              </div>
              <Link 
                href="/dashboard/student/history"
                className="p-2 text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-lg transition-colors"
                title="학습 히스토리"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                </svg>
              </Link>
              
              {/* 모바일 특강 메뉴 */}
              <div className="relative special-lecture-dropdown">
                <button
                  onClick={() => setShowSpecialLecture(!showSpecialLecture)}
                  className="p-2 text-gray-600 hover:text-purple-600 hover:bg-purple-50 rounded-lg transition-colors"
                  title="특강"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.746 0 3.332.477 4.5 1.253v13C19.832 18.477 18.246 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
                  </svg>
                </button>
                
                {/* 모바일 드롭다운 메뉴 */}
                {showSpecialLecture && (
                  <div className="absolute top-full right-0 mt-2 w-64 bg-white rounded-xl shadow-lg border border-gray-200 py-2 z-50 animate-fade-in">
                    <button
                      onClick={goToImageAnalysis}
                      className="w-full px-4 py-3 text-left hover:bg-gray-50 transition-colors flex items-center"
                    >
                      <div className="w-8 h-8 bg-blue-100 rounded-lg flex items-center justify-center mr-3">
                        <svg className="w-4 h-4 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                        </svg>
                      </div>
                      <div>
                        <div className="font-medium text-gray-900">이미지/시나리오 분석</div>
                      </div>
                    </button>
                    <button
                      onClick={goToSungkyulLecture}
                      className="w-full px-4 py-3 text-left hover:bg-gray-50 transition-colors flex items-center"
                    >
                      <div className="w-8 h-8 bg-purple-100 rounded-lg flex items-center justify-center mr-3">
                        <svg className="w-4 h-4 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                        </svg>
                      </div>
                      <div>
                        <div className="font-medium text-gray-900">성결대 특강</div>
                      </div>
                    </button>
                    <button
                      onClick={goToSungkyulLogline}
                      className="w-full px-4 py-3 text-left hover:bg-gray-50 transition-colors flex items-center"
                    >
                      <div className="w-8 h-8 bg-green-100 rounded-lg flex items-center justify-center mr-3">
                        <svg className="w-4 h-4 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v6a2 2 0 002 2h6a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01" />
                        </svg>
                      </div>
                      <div>
                        <div className="font-medium text-gray-900">성결대 로그라인</div>
                      </div>
                    </button>
                  </div>
                )}
              </div>
              
              <Link 
                href="/hall-of-fame"
                className="p-2 text-gray-600 hover:text-yellow-600 hover:bg-yellow-50 rounded-lg transition-colors"
                title="명예의 전당"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 3v4M3 5h4M6 17v4m-2-2h4m5-16l2.286 6.857L21 12l-5.714 2.143L13 21l-2.286-6.857L5 12l5.714-2.143L13 3z" />
                </svg>
              </Link>
              <button
                onClick={() => setShowPinChangeModal(true)}
                className="p-2 text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-lg transition-colors"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 7a2 2 0 012 2m0 0a2 2 0 012 2m-2-2a2 2 0 00-2 2m2 2v2a2 2 0 01-2 2m-2-2a2 2 0 01-2-2m2-2a2 2 0 012-2m0 0V5a2 2 0 00-2-2m-4 6V4a1 1 0 011-1h4a1 1 0 011 1v2m-6 0a1 1 0 00-1 1v4a1 1 0 001 1m-1-5h2m5 0h2" />
                </svg>
              </button>
            </div>
          </div>
        </div>
      </nav>

      <div className="max-w-7xl mx-auto px-4 lg:px-6 py-6 lg:py-8">
        {/* Welcome Header */}
        <div className="mb-6 lg:mb-8 animate-fade-in">
          <h1 className="text-2xl lg:text-4xl font-bold text-gray-900 mb-2">
            안녕하세요, <span className="bg-gradient-to-r from-blue-600 to-blue-600 bg-clip-text text-transparent">{user?.name}</span>님!
          </h1>
          <p className="text-base lg:text-xl text-gray-600">
            <span className="block lg:inline">{user?.className}</span>
            <span className="hidden lg:inline"> • </span>
            <span className="block lg:inline text-sm lg:text-xl">체계적인 학습으로 목표를 달성해보세요</span>
          </p>
        </div>

        {/* 명예의 전당 */}
        <div className="card animate-slide-up mb-6">
          <div className="bg-gradient-to-br from-yellow-50 to-amber-50 border border-yellow-200 rounded-2xl p-6">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center">
                <div className="w-12 h-12 bg-yellow-100 rounded-xl flex items-center justify-center mr-4">
                  <svg className="w-6 h-6 text-yellow-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 3v4M3 5h4M6 17v4m-2-2h4m5-16l2.286 6.857L21 12l-5.714 2.143L13 21l-2.286-6.857L5 12l5.714-2.143L13 3z" />
                  </svg>
                </div>
                <div>
                  <h3 className="text-xl font-bold text-yellow-800 flex items-center">
                    명예의 전당 🏆
                  </h3>
                  <p className="text-yellow-600 text-sm">우수한 성과를 거둔 학습 세션들을 확인해보세요</p>
                </div>
              </div>
              <div className="flex items-center space-x-1">
                <span className="text-2xl">🥇</span>
                <span className="text-xl">✨</span>
              </div>
            </div>
            
            <Link 
              href="/hall-of-fame"
              className="inline-flex items-center justify-center w-full py-3 px-4 bg-gradient-to-r from-yellow-500 to-amber-500 text-white font-semibold rounded-xl hover:from-yellow-600 hover:to-amber-600 transition-all duration-200 shadow-md hover:shadow-lg transform hover:-translate-y-0.5"
            >
              <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 3v4M3 5h4M6 17v4m-2-2h4m5-16l2.286 6.857L21 12l-5.714 2.143L13 21l-2.286-6.857L5 12l5.714-2.143L13 3z" />
              </svg>
              명예의 전당 둘러보기
              <svg className="w-4 h-4 ml-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 8l4 4m0 0l-4 4m4-4H3" />
              </svg>
            </Link>
          </div>
        </div>

        {/* 공지사항 */}
        <div className="card animate-slide-up mb-6">
          <div className="bg-gradient-to-br from-red-50 to-orange-50 border border-red-200 rounded-2xl p-6">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center">
                <div className="w-12 h-12 bg-red-100 rounded-xl flex items-center justify-center mr-4">
                  <svg className="w-6 h-6 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.196-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z" />
                  </svg>
                </div>
                <div>
                  <h3 className="text-xl font-bold text-red-800 flex items-center">
                    공지사항 📢
                  </h3>
                  <p className="text-red-600 text-sm">중요한 공지사항을 확인해주세요</p>
                </div>
              </div>
            </div>
            
            {announcementsLoading ? (
              <div className="text-center py-8">
                <div className="w-8 h-8 border-4 border-red-200 border-t-red-600 rounded-full animate-spin mx-auto mb-2"></div>
                <p className="text-red-600">공지사항을 불러오는 중...</p>
              </div>
            ) : announcements.length === 0 ? (
              <div className="text-center py-8">
                <div className="w-12 h-12 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-3">
                  <svg className="w-6 h-6 text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-2.586a1 1 0 00-.707.293l-2.414 2.414a1 1 0 01-.707.293h-3.172a1 1 0 01-.707-.293l-2.414-2.414A1 1 0 006.586 13H4" />
                  </svg>
                </div>
                <p className="text-red-500">현재 공지사항이 없습니다</p>
              </div>
            ) : (
              <div className="space-y-4">
                {announcements.map((announcement) => (
                  <div key={announcement.id} className="bg-white rounded-xl p-4 border border-red-200 shadow-sm hover:shadow-md transition-all duration-200">
                    <div className="flex items-start justify-between mb-2">
                      <h4 className="font-bold text-gray-900 text-lg flex items-center">
                        <span className="w-2 h-2 bg-red-500 rounded-full mr-3"></span>
                        {announcement.title}
                      </h4>
                      <span className="text-xs text-gray-500 whitespace-nowrap ml-4">
                        {new Date(announcement.created_at).toLocaleDateString('ko-KR', {
                          month: 'short',
                          day: 'numeric'
                        })}
                      </span>
                    </div>
                    <p className="text-gray-700 leading-relaxed mb-3 pl-5">{announcement.content}</p>
                    <div className="flex items-center justify-between pl-5">
                      <span className="text-xs text-gray-500">
                        {announcement.creator_name} 선생님 • {announcement.creator_class}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
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
          <div className="mb-6 lg:mb-8 p-3 lg:p-4 bg-gradient-to-r from-gray-50 to-blue-50 rounded-xl border border-gray-200">
            {/* 데스크톱 버전 */}
            <div className="hidden lg:flex items-center justify-between">
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

            {/* 모바일 버전 */}
            <div className="lg:hidden">
              <div className="text-center mb-3">
                <h3 className="text-lg font-bold text-gray-900 mb-1">
                  {currentWeekStart.getFullYear()}년 {currentWeekStart.getMonth() + 1}월 {currentWeekStart.getDate()}일 주간
                </h3>
                <button
                  onClick={goToCurrentWeek}
                  className="px-3 py-1 text-xs bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors shadow-sm"
                >
                  이번 주로
                </button>
              </div>
              <div className="flex items-center justify-between">
                <button
                  onClick={goToPreviousWeek}
                  className="flex items-center px-3 py-2 text-gray-600 hover:text-gray-900 hover:bg-white rounded-lg transition-all shadow-sm"
                >
                  <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                  </svg>
                  이전 주
                </button>
                
                <button
                  onClick={goToNextWeek}
                  className="flex items-center px-3 py-2 text-gray-600 hover:text-gray-900 hover:bg-white rounded-lg transition-all shadow-sm"
                >
                  다음 주
                  <svg className="w-4 h-4 ml-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                  </svg>
                </button>
              </div>
            </div>
          </div>

          {/* 내 예약 요약 - 미래/당일 예약만 표시 */}
          {reservations.filter(isFutureOrTodayReservation).length > 0 && (
            <div className="mb-6 lg:mb-8 p-4 lg:p-6 bg-gradient-to-br from-blue-50 to-indigo-50 rounded-2xl border border-blue-200">
              <h3 className="text-lg font-bold text-gray-900 mb-4 flex items-center">
                <div className="w-8 h-8 bg-blue-500 rounded-lg flex items-center justify-center mr-3">
                  <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                </div>
                내 예약 현황 ({reservations.filter(isFutureOrTodayReservation).length}개)
              </h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 lg:gap-4">
                {reservations.filter(isFutureOrTodayReservation).map((reservation) => {
                  const isToday = reservation.slot.date === getKoreanDate()
                  return (
                    <div
                      key={reservation.id}
                      className={`p-4 rounded-xl border-2 transition-all duration-200 ${
                        reservation.status === 'completed' ? 'bg-green-50 border-green-200' :
                        reservation.problem_selected ? 'bg-blue-50 border-blue-200' :
                        isToday ? 'bg-amber-50 border-amber-200' :
                        'bg-white border-gray-200'
                      }`}
                    >
                      <div className="flex justify-between items-start mb-3">
                        <div>
                          <p className="font-semibold text-gray-800 text-sm">
                            {formatDate(reservation.slot.date)}
                            {isToday && <span className="ml-2 text-xs bg-yellow-100 text-yellow-800 px-2 py-1 rounded-full">오늘</span>}
                          </p>
                          <p className="text-gray-600 text-sm">
                            {getSessionLabel(reservation.slot.session_period)} {formatTimeSlot(reservation.slot.time_slot)}
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
                        {isToday && !reservation.problem_selected && (
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
                  )
                })}
              </div>
            </div>
          )}

          {/* 데스크톱: 주간 캘린더 그리드 */}
          <div className="hidden lg:block">
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
              const dateString = formatDateString(date) // 로컬 Date 객체를 YYYY-MM-DD로 변환
              const dayReservations = reservations.filter(res => res.slot.date === dateString)
              const todayKST = getKoreanDate()
              const isToday = dateString === todayKST
              const isPast = dateString < todayKST
              
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
                    <div className="space-y-1">
                      {daySlots.map((slot) => (
                        <div
                          key={slot.id}
                          className={`p-2 rounded-lg cursor-pointer transition-all duration-200 border ${
                            selectedSlot === slot.id
                              ? 'bg-green-100 border-green-400 shadow-sm'
                              : 'bg-gray-50 hover:bg-gray-100 border-gray-200 hover:border-gray-300'
                          } ${isPast ? 'cursor-not-allowed opacity-50' : ''}`}
                          onClick={() => !isPast && setSelectedSlot(slot.id)}
                        >
                          <div className="font-medium text-gray-800 text-sm text-center">
                            {getSessionLabel(slot.session_period)} {formatTimeSlot(slot.time_slot)}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )
            })}
          </div>
          </div>

          {/* 모바일/태블릿: 날짜별 리스트 뷰 */}
          <div className="lg:hidden">
            {/* 요일 필터 드롭다운 */}
            <div className="mb-4 p-4 bg-gradient-to-r from-gray-50 to-blue-50 rounded-xl border border-gray-200">
              <label className="block text-sm font-semibold text-gray-700 mb-2">
                요일별 보기
              </label>
              <select
                value={selectedDayFilter ?? ''}
                onChange={(e) => setSelectedDayFilter(e.target.value === '' ? null : parseInt(e.target.value))}
                className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all bg-white text-gray-700 font-medium"
              >
                <option value="">전체 요일 보기</option>
                <option value="1">월요일</option>
                <option value="2">화요일</option>
                <option value="3">수요일</option>
                <option value="4">목요일</option>
                <option value="5">금요일</option>
                <option value="6">토요일</option>
                <option value="0">일요일</option>
              </select>
            </div>

            <div className="space-y-4 max-h-[70vh] overflow-y-auto">
              {getWeekDates(currentWeekStart).map((date, index) => {
                const daySlots = getSlotsByDate(date)
                const dateString = formatDateString(date)
                const dayReservations = reservations.filter(res => res.slot.date === dateString)
                const todayKST = getKoreanDate()
                const isToday = dateString === todayKST
                const isPast = dateString < todayKST
                
                // 요일 필터가 설정되어 있으면 해당 요일만 표시
                if (selectedDayFilter !== null && date.getDay() !== selectedDayFilter) {
                  return null
                }
                
                // 빈 날짜는 건너뛰기 (예약도 없고 슬롯도 없으면)
                if (daySlots.length === 0 && dayReservations.length === 0) {
                  return null
                }
                
                return (
                  <div
                    key={index}
                    className={`border-2 rounded-2xl transition-all duration-200 ${
                      isPast ? 'bg-gray-50 opacity-70' : 'bg-white'
                    } ${isToday ? 'border-blue-400 bg-blue-50 shadow-lg' : 'border-gray-200'}`}
                  >
                    {/* 날짜 헤더 */}
                    <div className={`p-4 border-b ${
                      isToday ? 'bg-blue-100 border-blue-200' : 'bg-gray-50 border-gray-200'
                    } rounded-t-2xl`}>
                      <div className="flex items-center justify-between">
                        <div>
                          <h3 className={`text-xl font-bold ${
                            isToday ? 'text-blue-700' : 'text-gray-700'
                          }`}>
                            {formatDateShort(date)}
                          </h3>
                          {isToday && (
                            <span className="inline-block mt-1 px-2 py-1 bg-blue-200 text-blue-800 text-xs rounded-full font-medium">
                              오늘
                            </span>
                          )}
                        </div>
                        <button
                          onClick={() => setShowDatePicker(true)}
                          className={`w-12 h-12 rounded-xl flex items-center justify-center transition-colors hover:scale-105 ${
                            isToday ? 'bg-blue-200 hover:bg-blue-300' : 'bg-gray-100 hover:bg-gray-200'
                          }`}
                        >
                          <svg className={`w-6 h-6 ${isToday ? 'text-blue-600' : 'text-gray-400'}`} 
                               fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} 
                                  d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 002 2z" />
                          </svg>
                        </button>
                      </div>
                    </div>

                    <div className="p-4 space-y-3">
                      {/* 내 예약 표시 */}
                      {dayReservations.map((reservation) => (
                        <div
                          key={`mobile-reservation-${reservation.id}`}
                          className={`p-4 rounded-xl border-2 ${
                            reservation.status === 'completed' ? 'bg-green-50 border-green-200' :
                            reservation.problem_selected ? 'bg-blue-50 border-blue-200' :
                            'bg-amber-50 border-amber-200'
                          }`}
                        >
                          <div className="flex items-center justify-between mb-2">
                            <div className="flex items-center">
                              <div className="w-8 h-8 bg-blue-500 rounded-lg flex items-center justify-center mr-3">
                                <span className="text-white text-sm font-bold">예약</span>
                              </div>
                              <div>
                                <p className="font-semibold text-gray-800 text-base">
                                  {getSessionLabel(reservation.slot.session_period)} {formatTimeSlot(reservation.slot.time_slot)}
                                </p>
                              </div>
                            </div>
                            <span className={`px-3 py-1 rounded-lg text-sm font-medium ${
                              reservation.status === 'completed' ? 'bg-green-100 text-green-800' :
                              reservation.problem_selected ? 'bg-blue-100 text-blue-800' :
                              'bg-yellow-100 text-yellow-800'
                            }`}>
                              {reservation.status === 'completed' ? '완료' :
                               reservation.problem_selected ? '문제선택완료' : '예약됨'}
                            </span>
                          </div>
                          
                          {/* 모바일용 액션 버튼들 */}
                          {isToday && !reservation.problem_selected && (
                            <button
                              onClick={async () => {
                                setCurrentReservationId(reservation.id)
                                await fetchProblems(reservation.slot.date)
                                setShowProblemModal(true)
                              }}
                              className="w-full mt-3 py-3 bg-blue-600 text-white rounded-xl font-semibold hover:bg-blue-700 transition-colors"
                            >
                              문제 선택하기 ✨
                            </button>
                          )}
                          {reservation.status === 'active' && (
                            <button
                              onClick={() => cancelReservation(reservation.id)}
                              className="w-full mt-3 py-3 bg-red-500 text-white rounded-xl font-semibold hover:bg-red-600 transition-colors"
                            >
                              예약 취소
                            </button>
                          )}
                        </div>
                      ))}
                      
                      {/* 예약 가능한 슬롯 표시 */}
                      {daySlots.length > 0 && (
                        <div className="space-y-2">
                          <h4 className="text-base font-semibold text-gray-700 mb-3">
                            예약 가능한 시간 ({daySlots.length}개)
                          </h4>
                          <div className="grid grid-cols-2 gap-2">
                            {daySlots.map((slot) => (
                              <button
                                key={slot.id}
                                className={`p-4 rounded-xl font-semibold transition-all duration-200 border-2 ${
                                  selectedSlot === slot.id
                                    ? 'bg-green-100 border-green-400 text-green-800 shadow-md scale-105'
                                    : 'bg-white border-gray-200 text-gray-700 hover:border-blue-300 hover:bg-blue-50'
                                } ${isPast ? 'cursor-not-allowed opacity-50' : 'active:scale-95'}`}
                                onClick={() => !isPast && setSelectedSlot(slot.id)}
                                disabled={isPast}
                              >
                                <div className="text-center">
                                  <div className="text-base font-bold">
                                    {getSessionLabel(slot.session_period)}
                                  </div>
                                  <div className="text-lg font-bold mt-1">
                                    {formatTimeSlot(slot.time_slot)}
                                  </div>
                                </div>
                              </button>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                )
              })}
            </div>
          </div>

          {/* 예약하기 버튼들 */}
          <div className="mt-8 pt-6 border-t-2 border-gray-200">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* 일반 예약 버튼 */}
              <button
                onClick={() => createReservation('normal')}
                disabled={!selectedSlot || remainingTickets <= 0}
                className={`py-6 px-8 rounded-2xl font-bold text-xl transition-all duration-300 ${
                  selectedSlot && remainingTickets > 0
                    ? 'bg-gradient-to-r from-blue-600 to-blue-700 text-white shadow-xl hover:shadow-2xl transform hover:-translate-y-2 hover:scale-105'
                    : 'bg-gray-200 text-gray-500 cursor-not-allowed'
                }`}
              >
                {remainingTickets <= 0 ? '이용권 부족 😔' : 
                 selectedSlot ? '일반 예약 📝' : '시간 선택 필요 📅'}
              </button>
              
              {/* 작법 예약 버튼 */}
              <button
                onClick={() => createReservation('essay')}
                disabled={!selectedSlot || remainingTickets < 2}
                className={`py-6 px-8 rounded-2xl font-bold text-xl transition-all duration-300 ${
                  selectedSlot && remainingTickets >= 2
                    ? 'bg-gradient-to-r from-purple-600 to-purple-700 text-white shadow-xl hover:shadow-2xl transform hover:-translate-y-2 hover:scale-105'
                    : 'bg-gray-200 text-gray-500 cursor-not-allowed'
                }`}
              >
                {remainingTickets < 2 ? '이용권 2장 필요 😔' : 
                 selectedSlot ? '작법 예약 ✍️' : '시간 선택 필요 📅'}
              </button>
            </div>
            
            {/* 안내 메시지 */}
            <div className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-4 text-sm text-gray-600">
              <div className="text-center p-3 bg-blue-50 rounded-lg">
                <strong>일반 예약:</strong> 이용권 1장, 1시간
              </div>
              <div className="text-center p-3 bg-purple-50 rounded-lg">
                <strong>작법 예약:</strong> 이용권 2장, 연속 2시간
              </div>
            </div>
          </div>
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

        {/* 날짜 선택 모달 */}
        {showDatePicker && (
          <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 px-4">
            <div className="bg-white rounded-3xl p-6 w-full max-w-sm shadow-2xl animate-slide-up">
              <div className="flex items-center justify-between mb-6">
                <h3 className="text-xl font-bold text-gray-900">날짜 선택</h3>
                <button
                  onClick={() => setShowDatePicker(false)}
                  className="w-8 h-8 bg-gray-100 rounded-full flex items-center justify-center hover:bg-gray-200 transition-colors"
                >
                  <svg className="w-4 h-4 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>

              <div className="space-y-3">
                {/* 빠른 날짜 선택 */}
                <div className="grid grid-cols-2 gap-3">
                  <button
                    onClick={() => goToSpecificDate(new Date())}
                    className="p-3 bg-blue-50 border border-blue-200 rounded-xl text-blue-700 font-medium hover:bg-blue-100 transition-colors"
                  >
                    오늘
                  </button>
                  <button
                    onClick={() => {
                      const tomorrow = new Date()
                      tomorrow.setDate(tomorrow.getDate() + 1)
                      goToSpecificDate(tomorrow)
                    }}
                    className="p-3 bg-gray-50 border border-gray-200 rounded-xl text-gray-700 font-medium hover:bg-gray-100 transition-colors"
                  >
                    내일
                  </button>
                </div>

                {/* 주간 선택 */}
                <div className="space-y-2">
                  <h4 className="text-sm font-semibold text-gray-700 mb-2">주간 이동</h4>
                  <div className="grid grid-cols-1 gap-2">
                    <button
                      onClick={() => {
                        const lastWeek = new Date()
                        lastWeek.setDate(lastWeek.getDate() - 7)
                        goToSpecificDate(lastWeek)
                      }}
                      className="p-3 bg-gray-50 border border-gray-200 rounded-xl text-gray-700 font-medium hover:bg-gray-100 transition-colors text-left"
                    >
                      지난 주
                    </button>
                    <button
                      onClick={() => goToSpecificDate(new Date())}
                      className="p-3 bg-blue-50 border border-blue-200 rounded-xl text-blue-700 font-medium hover:bg-blue-100 transition-colors text-left"
                    >
                      이번 주
                    </button>
                    <button
                      onClick={() => {
                        const nextWeek = new Date()
                        nextWeek.setDate(nextWeek.getDate() + 7)
                        goToSpecificDate(nextWeek)
                      }}
                      className="p-3 bg-gray-50 border border-gray-200 rounded-xl text-gray-700 font-medium hover:bg-gray-100 transition-colors text-left"
                    >
                      다음 주
                    </button>
                  </div>
                </div>

                {/* 현재 주의 날짜들 */}
                <div className="space-y-2">
                  <h4 className="text-sm font-semibold text-gray-700 mb-2">이번 주 날짜</h4>
                  <div className="grid grid-cols-7 gap-1">
                    {getWeekDates(currentWeekStart).map((date, index) => {
                      const isToday = formatDateString(date) === getKoreanDate()
                      const dayOfWeek = ['일', '월', '화', '수', '목', '금', '토'][date.getDay()]
                      const daySlots = getSlotsByDate(date)
                      const hasSlots = daySlots.length > 0
                      
                      return (
                        <button
                          key={index}
                          onClick={() => goToSpecificDate(date)}
                          className={`p-2 rounded-lg text-center text-xs transition-colors ${
                            isToday 
                              ? 'bg-blue-200 text-blue-800 font-bold' 
                              : hasSlots 
                                ? 'bg-green-50 text-green-700 hover:bg-green-100' 
                                : 'bg-gray-50 text-gray-500 hover:bg-gray-100'
                          }`}
                        >
                          <div className="font-medium">{dayOfWeek}</div>
                          <div>{date.getDate()}</div>
                          {hasSlots && <div className="w-1 h-1 bg-green-500 rounded-full mx-auto mt-1"></div>}
                        </button>
                      )
                    })}
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}