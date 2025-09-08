'use client'

import { useState, useEffect, useCallback } from 'react'
import { withAuth } from '@/lib/withAuth'

interface Account {
  id: string
  name: string
  class_name: string
  role: string
  current_tickets: number
  created_at: string
}

interface TicketStats {
  totalStudents: number
  totalTickets: number
  averageTickets: number
  classSummary: { [key: string]: { students: number; tickets: number } }
}

function AdminDashboard() {
  const [accounts, setAccounts] = useState<Account[]>([])
  const [ticketStats, setTicketStats] = useState<TicketStats | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [issuingWeekly, setIssuingWeekly] = useState(false)
  const [selectedStudent, setSelectedStudent] = useState<string>('')
  const [grantAmount, setGrantAmount] = useState<number>(1)
  const [grantReason, setGrantReason] = useState<string>('')
  const [showGrantModal, setShowGrantModal] = useState(false)
  const [showAddAccountModal, setShowAddAccountModal] = useState(false)
  const [showCreateSlotsModal, setShowCreateSlotsModal] = useState(false)
  const [newAccount, setNewAccount] = useState({ name: '', className: '', role: 'student', pin: '' })
  const [slotForm, setSlotForm] = useState<{ 
    date: string; 
    teacherId: string; 
    blocks: Array<{block: 'AM' | 'PM'; maxCapacity: number}> 
  }>({ date: '', teacherId: '', blocks: [] })
  const [existingSlots, setExistingSlots] = useState<any[]>([])
  const [selectedWeekView, setSelectedWeekView] = useState('')
  const [teachers, setTeachers] = useState<Account[]>([])

  const fetchAccounts = useCallback(async () => {
    try {
      setLoading(true)
      const response = await fetch('/api/admin/accounts')
      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || '계정 조회에 실패했습니다.')
      }

      setAccounts(data.accounts)
      calculateTicketStats(data.accounts)
    } catch (err) {
      setError(err instanceof Error ? err.message : '오류가 발생했습니다.')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchAccounts()
  }, [fetchAccounts])

  useEffect(() => {
    if (accounts.length > 0) {
      setTeachers(accounts.filter(account => account.role === 'teacher'))
    }
  }, [accounts])

  const calculateTicketStats = (accounts: Account[]) => {
    const students = accounts.filter(account => account.role === 'student')
    const totalTickets = students.reduce((sum, student) => sum + student.current_tickets, 0)
    
    const classSummary = students.reduce((acc, student) => {
      if (!acc[student.class_name]) {
        acc[student.class_name] = { students: 0, tickets: 0 }
      }
      acc[student.class_name].students++
      acc[student.class_name].tickets += student.current_tickets
      return acc
    }, {} as { [key: string]: { students: number; tickets: number } })

    setTicketStats({
      totalStudents: students.length,
      totalTickets,
      averageTickets: students.length > 0 ? Math.round(totalTickets / students.length * 10) / 10 : 0,
      classSummary
    })
  }

  const handleWeeklyIssue = async () => {
    try {
      setIssuingWeekly(true)
      const response = await fetch('/api/admin/tickets/weekly-issue', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ ticketCount: 10 })
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || '주간 이용권 발급에 실패했습니다.')
      }

      alert(data.message)
      fetchAccounts() // 데이터 새로고침
    } catch (err) {
      alert(err instanceof Error ? err.message : '오류가 발생했습니다.')
    } finally {
      setIssuingWeekly(false)
    }
  }

  const handleIndividualGrant = async () => {
    if (!selectedStudent || grantAmount <= 0) {
      alert('학생과 발급할 이용권 수량을 선택해주세요.')
      return
    }

    try {
      const response = await fetch('/api/admin/tickets/grant', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          studentId: selectedStudent,
          ticketCount: grantAmount,
          reason: grantReason
        })
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || '개별 이용권 발급에 실패했습니다.')
      }

      alert(data.message)
      setShowGrantModal(false)
      setSelectedStudent('')
      setGrantAmount(1)
      setGrantReason('')
      fetchAccounts() // 데이터 새로고침
    } catch (err) {
      alert(err instanceof Error ? err.message : '오류가 발생했습니다.')
    }
  }

  const deleteAccount = async (accountId: string, accountName: string) => {
    if (!confirm(`${accountName} 계정을 정말 삭제하시겠습니까?`)) {
      return
    }

    try {
      const response = await fetch(`/api/admin/accounts/${accountId}`, {
        method: 'DELETE'
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || '계정 삭제에 실패했습니다.')
      }

      alert(data.message)
      fetchAccounts() // 데이터 새로고침
    } catch (err) {
      alert(err instanceof Error ? err.message : '오류가 발생했습니다.')
    }
  }

  const handleCreateAccount = async () => {
    if (!newAccount.name || !newAccount.className || !newAccount.pin) {
      alert('모든 필드를 입력해주세요.')
      return
    }

    if (newAccount.pin.length !== 4 || !/^\d{4}$/.test(newAccount.pin)) {
      alert('PIN은 4자리 숫자여야 합니다.')
      return
    }

    try {
      const response = await fetch('/api/admin/accounts', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          name: newAccount.name,
          className: newAccount.className,
          role: newAccount.role,
          pin: newAccount.pin
        })
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || '계정 생성에 실패했습니다.')
      }

      alert(`${newAccount.name} 계정이 생성되었습니다.`)
      setShowAddAccountModal(false)
      setNewAccount({ name: '', className: '', role: 'student', pin: '' })
      fetchAccounts() // 데이터 새로고침
    } catch (err) {
      alert(err instanceof Error ? err.message : '오류가 발생했습니다.')
    }
  }

  const getTodayDate = () => {
    const now = new Date()
    return now.toISOString().split('T')[0]
  }

  const getCurrentWeek = () => {
    const now = new Date()
    const year = now.getFullYear()
    const start = new Date(year, 0, 1)
    const days = Math.floor((now.getTime() - start.getTime()) / (24 * 60 * 60 * 1000))
    const week = Math.ceil((days + start.getDay() + 1) / 7)
    return `${year}-${week.toString().padStart(2, '0')}`
  }

  const fetchExistingSlots = async (week?: string) => {
    if (!week) return
    try {
      const response = await fetch(`/api/admin/slots?week=${week}`)
      const data = await response.json()
      if (data.success) {
        setExistingSlots(data.slots || [])
      }
    } catch (error) {
      console.error('기존 슬롯 조회 실패:', error)
    }
  }

  const handleCreateSlots = async () => {
    if (!slotForm.date || !slotForm.teacherId || slotForm.blocks.length === 0) {
      alert('날짜, 교사, 시간 블록을 모두 선택해주세요.')
      return
    }

    // 날짜를 주차로 변환 (기존 API 호환)
    const selectedDate = new Date(slotForm.date)
    const year = selectedDate.getFullYear()
    const start = new Date(year, 0, 1)
    const days = Math.floor((selectedDate.getTime() - start.getTime()) / (24 * 60 * 60 * 1000))
    const week = Math.ceil((days + start.getDay() + 1) / 7)
    const weekStr = `${year}-${week.toString().padStart(2, '0')}`
    const dayOfWeek = selectedDate.getDay() || 7 // 일요일=7, 월요일=1

    if (dayOfWeek > 5) {
      alert('주말에는 예약 슬롯을 생성할 수 없습니다.')
      return
    }

    try {
      const response = await fetch('/api/admin/slots', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          date: slotForm.date,
          teacherId: parseInt(slotForm.teacherId),
          blocks: slotForm.blocks.map(block => ({
            block: block.block,
            maxCapacity: block.maxCapacity
          }))
        })
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || '슬롯 생성에 실패했습니다.')
      }

      alert(data.message)
      setShowCreateSlotsModal(false)
      setSlotForm({ date: '', teacherId: '', blocks: [] })
      // 기존 슬롯 새로고침
      if (selectedWeekView) {
        fetchExistingSlots(selectedWeekView)
      }
    } catch (err) {
      alert(err instanceof Error ? err.message : '오류가 발생했습니다.')
    }
  }

  const addTimeBlock = () => {
    setSlotForm(prev => ({
      ...prev,
      blocks: [...prev.blocks, { block: 'AM', maxCapacity: 1 }]
    }))
  }

  const removeTimeBlock = (index: number) => {
    setSlotForm(prev => ({
      ...prev,
      blocks: prev.blocks.filter((_, i) => i !== index)
    }))
  }

  const updateTimeBlock = (index: number, field: string, value: any) => {
    setSlotForm(prev => ({
      ...prev,
      blocks: prev.blocks.map((block, i) => 
        i === index ? { ...block, [field]: value } : block
      )
    }))
  }

  const deleteExistingSlot = async (slotId: number, slotInfo: string) => {
    // 삭제 API가 구현되어 있지 않으므로 임시 비활성화
    alert('슬롯 삭제 기능은 현재 개발 중입니다.')
  }

  const getBlockTime = (block: string) => {
    return block === 'AM' ? '오전 (10:00~16:00)' : '오후 (16:00~22:00)'
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">데이터를 불러오는 중...</p>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <p className="text-red-600 mb-4">{error}</p>
          <button
            onClick={() => window.location.reload()}
            className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
          >
            다시 시도
          </button>
        </div>
      </div>
    )
  }

  const students = accounts.filter(account => account.role === 'student')

  return (
    <div className="min-h-screen bg-gray-50 py-8 px-4">
      <div className="max-w-7xl mx-auto">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">관리자 대시보드</h1>
          <p className="text-gray-600">계정 관리 및 이용권 현황</p>
        </div>

        {/* 이용권 현황 */}
        {ticketStats && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
            <div className="bg-white p-6 rounded-lg shadow">
              <h3 className="text-lg font-semibold text-gray-900 mb-2">전체 학생</h3>
              <p className="text-3xl font-bold text-blue-600">{ticketStats.totalStudents}명</p>
            </div>
            <div className="bg-white p-6 rounded-lg shadow">
              <h3 className="text-lg font-semibold text-gray-900 mb-2">전체 이용권</h3>
              <p className="text-3xl font-bold text-green-600">{ticketStats.totalTickets}장</p>
            </div>
            <div className="bg-white p-6 rounded-lg shadow">
              <h3 className="text-lg font-semibold text-gray-900 mb-2">평균 이용권</h3>
              <p className="text-3xl font-bold text-yellow-600">{ticketStats.averageTickets}장</p>
            </div>
            <div className="bg-white p-6 rounded-lg shadow">
              <h3 className="text-lg font-semibold text-gray-900 mb-2">반 수</h3>
              <p className="text-3xl font-bold text-purple-600">{Object.keys(ticketStats.classSummary).length}개</p>
            </div>
          </div>
        )}

        {/* 관리 기능 */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
          {/* 이용권 관리 */}
          <div className="bg-white p-6 rounded-lg shadow">
            <h2 className="text-xl font-semibold text-gray-900 mb-4">이용권 관리</h2>
            <div className="mb-4 p-3 bg-yellow-50 border border-yellow-200 rounded">
              <p className="text-yellow-800 text-sm font-medium">
                ⚠️ 개인당 최대 10장까지만 보유 가능합니다.
              </p>
            </div>
            <div className="space-y-3">
              <button
                onClick={handleWeeklyIssue}
                disabled={issuingWeekly}
                className="w-full px-6 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50"
              >
                {issuingWeekly ? '발급 중...' : '주간 일괄 발급 (10장)'}
              </button>
              <button
                onClick={() => setShowGrantModal(true)}
                className="w-full px-6 py-2 bg-green-600 text-white rounded hover:bg-green-700"
              >
                개별 발급
              </button>
            </div>
          </div>

          {/* 계정 및 시간표 관리 */}
          <div className="bg-white p-6 rounded-lg shadow">
            <h2 className="text-xl font-semibold text-gray-900 mb-4">시스템 관리</h2>
            <div className="space-y-3">
              <button
                onClick={() => setShowAddAccountModal(true)}
                className="w-full px-6 py-2 bg-purple-600 text-white rounded hover:bg-purple-700"
              >
                새 계정 추가
              </button>
              <button
                onClick={() => window.open('/dashboard/admin/timeslot-management', '_blank')}
                className="w-full px-6 py-2 bg-indigo-600 text-white rounded hover:bg-indigo-700"
              >
                타임슬롯 관리 (새 창)
              </button>
              <button
                onClick={() => {
                  setSelectedWeekView(getCurrentWeek())
                  fetchExistingSlots(getCurrentWeek())
                }}
                className="w-full px-6 py-2 bg-gray-600 text-white rounded hover:bg-gray-700"
              >
                주간 스케줄 보기
              </button>
            </div>
          </div>
        </div>

        {/* 반별 현황 */}
        {ticketStats && Object.keys(ticketStats.classSummary).length > 0 && (
          <div className="bg-white p-6 rounded-lg shadow mb-8">
            <h2 className="text-xl font-semibold text-gray-900 mb-4">반별 현황</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {Object.entries(ticketStats.classSummary).map(([className, stats]) => (
                <div key={className} className="border rounded-lg p-4">
                  <h3 className="font-semibold text-gray-900 mb-2">{className}</h3>
                  <p className="text-sm text-gray-600">학생: {stats.students}명</p>
                  <p className="text-sm text-gray-600">이용권: {stats.tickets}장</p>
                  <p className="text-sm text-gray-600">
                    평균: {Math.round(stats.tickets / stats.students * 10) / 10}장
                  </p>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* 주간 스케줄 보기 */}
        {selectedWeekView && (
          <div className="bg-white rounded-lg shadow mb-8">
            <div className="p-6 border-b">
              <div className="flex justify-between items-center">
                <h2 className="text-xl font-semibold text-gray-900">{selectedWeekView} 주차 스케줄</h2>
                <button
                  onClick={() => setSelectedWeekView('')}
                  className="text-gray-500 hover:text-gray-700"
                >
                  닫기
                </button>
              </div>
            </div>
            <div className="p-6">
              {existingSlots.length === 0 ? (
                <div className="text-center py-8 text-gray-500">
                  이 주차에 등록된 슬롯이 없습니다.
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="min-w-full divide-y divide-gray-200">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">날짜</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">시간</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">교사</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">예약현황</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">관리</th>
                      </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-200">
                      {existingSlots.map((slot) => (
                        <tr key={slot.id} className="hover:bg-gray-50">
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                            {new Date(slot.date).toLocaleDateString('ko-KR', { weekday: 'short', month: 'short', day: 'numeric' })}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                            {slot.time_slot ? 
                              `${slot.session_period === 'AM' ? '오전' : '오후'} ${slot.time_slot}` : 
                              getBlockTime(slot.block)
                            }
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                            {slot.teacher?.name || '알 수 없음'}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                            <span className={`px-2 py-1 text-xs rounded-full ${
                              slot.current_reservations >= slot.max_capacity 
                                ? 'bg-red-100 text-red-800' 
                                : 'bg-green-100 text-green-800'
                            }`}>
                              {slot.current_reservations}/{slot.max_capacity}명
                            </span>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                            <button
                              onClick={() => window.open('/dashboard/admin/timeslot-management', '_blank')}
                              className="text-blue-600 hover:text-blue-900 text-sm"
                            >
                              관리
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        )}

        {/* 계정 목록 */}
        <div className="bg-white rounded-lg shadow">
          <div className="p-6 border-b">
            <div className="flex justify-between items-center">
              <h2 className="text-xl font-semibold text-gray-900">전체 계정</h2>
              <span className="text-sm text-gray-500">총 {accounts.length}개 계정</span>
            </div>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">이름</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">반</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">역할</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">잔여 이용권</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">생성일</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">관리</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {accounts.map((account) => (
                  <tr key={account.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                      {account.name}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {account.class_name}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
                        account.role === 'admin' ? 'bg-red-100 text-red-800' :
                        account.role === 'teacher' ? 'bg-yellow-100 text-yellow-800' :
                        'bg-blue-100 text-blue-800'
                      }`}>
                        {account.role === 'admin' ? '관리자' : 
                         account.role === 'teacher' ? '선생님' : '학생'}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {account.role === 'student' ? (
                        <div>
                          <span className={`font-medium ${account.current_tickets >= 10 ? 'text-red-600' : 'text-gray-900'}`}>
                            {account.current_tickets}장
                          </span>
                          <span className="text-gray-400 text-xs ml-1">/10</span>
                          {account.current_tickets >= 10 && (
                            <div className="text-xs text-red-500">최대</div>
                          )}
                        </div>
                      ) : '-'}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {new Date(account.created_at).toLocaleDateString('ko-KR')}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {account.role !== 'admin' && (
                        <button
                          onClick={() => deleteAccount(account.id, account.name)}
                          className="text-red-600 hover:text-red-900"
                        >
                          삭제
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* 개별 발급 모달 */}
      {showGrantModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg p-6 w-full max-w-md">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">개별 이용권 발급</h3>
            
            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 mb-2">학생 선택</label>
              <select
                value={selectedStudent}
                onChange={(e) => setSelectedStudent(e.target.value)}
                className="w-full border border-gray-300 rounded-md px-3 py-2"
              >
                <option value="">학생을 선택하세요</option>
                {students.map((student) => (
                  <option key={student.id} value={student.id}>
                    {student.name} ({student.class_name})
                  </option>
                ))}
              </select>
            </div>

            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 mb-2">발급 수량</label>
              <input
                type="number"
                min="1"
                value={grantAmount}
                onChange={(e) => setGrantAmount(parseInt(e.target.value) || 1)}
                className="w-full border border-gray-300 rounded-md px-3 py-2"
              />
            </div>

            <div className="mb-6">
              <label className="block text-sm font-medium text-gray-700 mb-2">발급 사유 (선택)</label>
              <input
                type="text"
                value={grantReason}
                onChange={(e) => setGrantReason(e.target.value)}
                placeholder="예: 추가 과제 완료"
                className="w-full border border-gray-300 rounded-md px-3 py-2"
              />
            </div>

            <div className="flex gap-3">
              <button
                onClick={() => setShowGrantModal(false)}
                className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded hover:bg-gray-50"
              >
                취소
              </button>
              <button
                onClick={handleIndividualGrant}
                className="flex-1 px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700"
              >
                발급
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 계정 추가 모달 */}
      {showAddAccountModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg p-6 w-full max-w-md">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">새 계정 추가</h3>
            
            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 mb-2">이름</label>
              <input
                type="text"
                value={newAccount.name}
                onChange={(e) => setNewAccount({...newAccount, name: e.target.value})}
                className="w-full border border-gray-300 rounded-md px-3 py-2"
                placeholder="이름을 입력하세요"
              />
            </div>

            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 mb-2">반</label>
              <input
                type="text"
                value={newAccount.className}
                onChange={(e) => setNewAccount({...newAccount, className: e.target.value})}
                className="w-full border border-gray-300 rounded-md px-3 py-2"
                placeholder="예: 3-1"
              />
            </div>

            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 mb-2">역할</label>
              <select
                value={newAccount.role}
                onChange={(e) => setNewAccount({...newAccount, role: e.target.value})}
                className="w-full border border-gray-300 rounded-md px-3 py-2"
              >
                <option value="student">학생</option>
                <option value="teacher">선생님</option>
                <option value="admin">관리자</option>
              </select>
            </div>

            <div className="mb-6">
              <label className="block text-sm font-medium text-gray-700 mb-2">PIN 코드 (4자리)</label>
              <input
                type="password"
                maxLength={4}
                value={newAccount.pin}
                onChange={(e) => setNewAccount({...newAccount, pin: e.target.value})}
                className="w-full border border-gray-300 rounded-md px-3 py-2"
                placeholder="4자리 숫자"
              />
            </div>

            <div className="flex gap-3">
              <button
                onClick={() => setShowAddAccountModal(false)}
                className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded hover:bg-gray-50"
              >
                취소
              </button>
              <button
                onClick={handleCreateAccount}
                className="flex-1 px-4 py-2 bg-purple-600 text-white rounded hover:bg-purple-700"
              >
                추가
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 타임슬롯 관리로 이동 안내 모달 */}
      {showCreateSlotsModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg p-6 w-full max-w-md">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">타임슬롯 관리</h3>
            
            <div className="mb-6">
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                <div className="flex items-start">
                  <div className="flex-shrink-0">
                    <svg className="w-6 h-6 text-blue-600 mt-0.5" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
                    </svg>
                  </div>
                  <div className="ml-3">
                    <h4 className="text-sm font-medium text-blue-800 mb-2">
                      새로운 타임슬롯 관리 시스템
                    </h4>
                    <p className="text-sm text-blue-700 mb-3">
                      이제 10분 단위로 정밀한 타임슬롯을 생성하고 관리할 수 있습니다.
                    </p>
                    <ul className="text-xs text-blue-700 space-y-1">
                      <li>• 10분 간격으로 세밀한 시간 설정</li>
                      <li>• 쉬는시간 블록 설정 가능</li>
                      <li>• 개별 슬롯 삭제 및 관리</li>
                      <li>• 실시간 예약 현황 확인</li>
                    </ul>
                  </div>
                </div>
              </div>
            </div>

            <div className="flex gap-3">
              <button
                onClick={() => setShowCreateSlotsModal(false)}
                className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded hover:bg-gray-50"
              >
                닫기
              </button>
              <button
                onClick={() => {
                  setShowCreateSlotsModal(false)
                  window.open('/dashboard/admin/timeslot-management', '_blank')
                }}
                className="flex-1 px-4 py-2 bg-indigo-600 text-white rounded hover:bg-indigo-700"
              >
                타임슬롯 관리 열기
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default withAuth(AdminDashboard, { roles: ['admin'] })