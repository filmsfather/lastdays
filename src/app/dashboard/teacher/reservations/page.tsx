'use client'

import { useState, useEffect } from 'react'
import { toast } from 'react-hot-toast'
import Link from 'next/link'
import { getKoreanDate, toKoreanDateString } from '@/lib/dateUtils'

interface User {
  id: number
  name: string
  class_name: string
  role: string
}

interface ReservationSlot {
  id: number
  date: string
  time_slot: string
  session_period: 'AM' | 'PM'
  teacher_id: number
  teacher_name: string
  teacher_class: string
  max_capacity: number
  current_reservations: number
  is_available: boolean
  students?: StudentReservation[]
}

interface StudentReservation {
  id: number
  student_name: string
  student_class: string
}

interface ReservationTableData {
  timeSlot: string
  teachers: {
    [teacherName: string]: StudentReservation[]
  }
}

export default function TeacherReservationsPage() {
  const [user, setUser] = useState<User | null>(null)
  const [selectedDay, setSelectedDay] = useState<number>(new Date().getDay())
  const [reservationData, setReservationData] = useState<ReservationSlot[]>([])
  const [loading, setLoading] = useState(false)

  const dayNames = ['일요일', '월요일', '화요일', '수요일', '목요일', '금요일', '토요일']

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

  // 선택한 요일의 예약 현황 조회
  const fetchReservationData = async () => {
    if (!selectedDay && selectedDay !== 0) return

    setLoading(true)
    try {
      // 선택한 요일의 날짜 계산 (이번 주 기준)
      const today = getKoreanDate()
      const currentDay = today.getDay()
      const diff = selectedDay - currentDay
      const targetDate = new Date(today)
      targetDate.setDate(today.getDate() + diff)
      const targetDateString = toKoreanDateString(targetDate)

      // 새로운 예약 현황 API 호출
      const response = await fetch(`/api/teacher/reservations/schedule?date=${targetDateString}`, {
        credentials: 'include'
      })
      const data = await response.json()

      if (data.success) {
        setReservationData(data.slots)
      } else {
        toast.error(data.error || '예약 현황 조회에 실패했습니다.')
      }
    } catch (error) {
      console.error('예약 현황 조회 실패:', error)
      toast.error('예약 현황 조회 중 오류가 발생했습니다.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (user) {
      fetchReservationData()
    }
  }, [user, selectedDay])

  // 테이블 데이터 구성
  const getTableData = (): ReservationTableData[] => {
    const timeSlots: string[] = []
    const teacherNames: string[] = []

    // 모든 시간대와 선생님 이름 수집
    reservationData.forEach(slot => {
      if (!timeSlots.includes(slot.time_slot)) {
        timeSlots.push(slot.time_slot)
      }
      if (!teacherNames.includes(slot.teacher_name)) {
        teacherNames.push(slot.teacher_name)
      }
    })

    // 시간순 정렬
    timeSlots.sort()
    teacherNames.sort()

    // 테이블 데이터 구성
    return timeSlots.map(timeSlot => {
      const teachers: { [teacherName: string]: StudentReservation[] } = {}
      
      teacherNames.forEach(teacherName => {
        const slot = reservationData.find(s => s.time_slot === timeSlot && s.teacher_name === teacherName)
        teachers[teacherName] = slot?.students || []
      })

      return {
        timeSlot,
        teachers
      }
    })
  }

  const tableData = getTableData()
  const teacherNames = reservationData.length > 0 
    ? [...new Set(reservationData.map(slot => slot.teacher_name))].sort()
    : []

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
    <div className="min-h-screen bg-gray-100">
      <div className="container mx-auto px-4 py-8">
        {/* 헤더 */}
        <div className="bg-white rounded-lg shadow-md p-6 mb-6">
          <div className="flex justify-between items-center">
            <div>
              <h1 className="text-2xl font-bold text-gray-800">
                예약 현황 조회
              </h1>
              <p className="text-gray-600">선생님별 예약 현황을 확인할 수 있습니다</p>
            </div>
            <Link 
              href="/dashboard/teacher"
              className="px-4 py-2 bg-gray-500 text-white rounded-lg hover:bg-gray-600 transition-colors"
            >
              ← 교사 대시보드
            </Link>
          </div>
        </div>

        {/* 요일 선택 */}
        <div className="bg-white rounded-lg shadow-md p-6 mb-6">
          <div className="flex items-center space-x-4">
            <label className="text-lg font-medium text-gray-700">
              조회할 요일:
            </label>
            <select
              value={selectedDay}
              onChange={(e) => setSelectedDay(parseInt(e.target.value))}
              className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            >
              {dayNames.map((day, index) => (
                <option key={index} value={index}>
                  {day}
                </option>
              ))}
            </select>
            <button
              onClick={fetchReservationData}
              className="px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors"
            >
              새로고침
            </button>
          </div>
        </div>

        {/* 예약 현황 테이블 */}
        <div className="bg-white rounded-lg shadow-md overflow-hidden">
          <div className="p-6 border-b border-gray-200">
            <h3 className="text-lg font-semibold text-gray-800">
              {dayNames[selectedDay]} 예약 현황
            </h3>
          </div>

          {loading ? (
            <div className="p-8 text-center">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500 mx-auto mb-4"></div>
              <p className="text-gray-600">데이터를 불러오는 중...</p>
            </div>
          ) : tableData.length === 0 ? (
            <div className="p-8 text-center">
              <div className="text-gray-400 mb-4">
                <svg className="mx-auto h-12 w-12" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M19,3H5C3.89,3 3,3.89 3,5V19A2,2 0 0,0 5,21H19A2,2 0 0,0 21,19V5C21,3.89 20.1,3 19,3M19,5V19H5V5H19Z" />
                </svg>
              </div>
              <h4 className="text-lg font-medium text-gray-600 mb-2">
                {dayNames[selectedDay]}에는 예약된 슬롯이 없습니다
              </h4>
              <p className="text-gray-500">
                다른 요일을 선택하거나 스케줄이 등록되었는지 확인해주세요
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider border-r border-gray-200">
                      시간
                    </th>
                    {teacherNames.map((teacherName) => (
                      <th 
                        key={teacherName}
                        className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider border-r border-gray-200"
                      >
                        {teacherName}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {tableData.map((row) => (
                    <tr key={row.timeSlot} className="hover:bg-gray-50">
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900 border-r border-gray-200">
                        {row.timeSlot}
                      </td>
                      {teacherNames.map((teacherName) => (
                        <td 
                          key={teacherName}
                          className="px-6 py-4 text-center border-r border-gray-200"
                        >
                          {row.teachers[teacherName].length === 0 ? (
                            <span className="text-gray-400 text-sm">-</span>
                          ) : (
                            <div className="space-y-1">
                              {row.teachers[teacherName].map((student, index) => (
                                <div
                                  key={student.id}
                                  className="inline-block px-2 py-1 bg-blue-100 text-blue-800 text-xs rounded-full mr-1 mb-1"
                                >
                                  {student.student_name}
                                  <span className="text-blue-600 ml-1">
                                    ({student.student_class})
                                  </span>
                                </div>
                              ))}
                            </div>
                          )}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* 도움말 */}
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mt-6">
          <h4 className="font-medium text-blue-800 mb-2">사용 안내</h4>
          <div className="text-sm text-blue-700 space-y-1">
            <p>• 요일을 선택하면 해당 요일의 모든 선생님별 예약 현황을 확인할 수 있습니다</p>
            <p>• 각 셀에는 해당 시간대에 예약한 학생들의 이름과 반이 표시됩니다</p>
            <p>• 예약이 없는 시간대는 &apos;-&apos;로 표시됩니다</p>
            <p>• 새로고침 버튼을 클릭하여 최신 예약 현황을 확인할 수 있습니다</p>
          </div>
        </div>
      </div>
    </div>
  )
}