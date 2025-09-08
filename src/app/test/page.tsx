'use client'

import { useState } from 'react'
import { supabase } from '@/lib/supabase'

export default function TestPage() {
  const [connectionStatus, setConnectionStatus] = useState<string>('')
  const [testResult, setTestResult] = useState<string>('')
  const [authResult, setAuthResult] = useState<string>('')
  const [slotResult, setSlotResult] = useState<string>('')
  const [reservationResult, setReservationResult] = useState<string>('')
  const [problemResult, setProblemResult] = useState<string>('')
  const [schedulerResult, setSchedulerResult] = useState<string>('')
  const [isLoading, setIsLoading] = useState(false)
  const [currentUser, setCurrentUser] = useState<any>(null)

  // 1. 데이터베이스 연결 테스트
  const testConnection = async () => {
    setIsLoading(true)
    setConnectionStatus('연결 테스트 중...')
    
    try {
      const { data, error } = await supabase
        .from('accounts')
        .select('count', { count: 'exact', head: true })
      
      if (error) {
        setConnectionStatus(`❌ 연결 실패: ${error.message}`)
      } else {
        setConnectionStatus('✅ Supabase 데이터베이스 연결 성공!')
      }
    } catch (err) {
      setConnectionStatus(`❌ 오류: ${err}`)
    } finally {
      setIsLoading(false)
    }
  }

  // 2. 테스트 계정 데이터 삽입
  const insertTestData = async () => {
    setIsLoading(true)
    setTestResult('테스트 데이터 삽입 중...')
    
    try {
      const { data, error } = await supabase
        .from('accounts')
        .insert([
          {
            name: '테스트학생',
            class_name: '3-1',
            role: 'student',
            pin: '1234'
          },
          {
            name: '김선생',
            class_name: '수학교사',
            role: 'teacher',
            pin: '5678'
          },
          {
            name: '관리자',
            class_name: 'admin',
            role: 'admin',
            pin: '0000'
          }
        ])
        .select()

      if (error) {
        setTestResult(`❌ 데이터 삽입 실패: ${error.message}`)
      } else {
        setTestResult(`✅ 테스트 데이터 삽입 성공!\n${JSON.stringify(data, null, 2)}`)
      }
    } catch (err) {
      setTestResult(`❌ 오류: ${err}`)
    } finally {
      setIsLoading(false)
    }
  }

  // 3. 로그인 테스트 (학생)
  const testStudentLogin = async () => {
    setIsLoading(true)
    setAuthResult('학생 로그인 테스트 중...')
    
    try {
      const response = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: '테스트학생',
          className: '3-1',
          pin: '1234'
        })
      })

      const data = await response.json()
      
      if (response.ok) {
        setCurrentUser(data.user)
        setAuthResult(`✅ 학생 로그인 성공!\n사용자: ${data.user.name} (${data.user.role})`)
      } else {
        setAuthResult(`❌ 로그인 실패: ${data.error}`)
      }
    } catch (err) {
      setAuthResult(`❌ 오류: ${err}`)
    } finally {
      setIsLoading(false)
    }
  }

  // 4. 로그인 테스트 (교사)
  const testTeacherLogin = async () => {
    setIsLoading(true)
    setAuthResult('교사 로그인 테스트 중...')
    
    try {
      const response = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: '김선생',
          className: '수학교사',
          pin: '5678'
        })
      })

      const data = await response.json()
      
      if (response.ok) {
        setCurrentUser(data.user)
        setAuthResult(`✅ 교사 로그인 성공!\n사용자: ${data.user.name} (${data.user.role})`)
      } else {
        setAuthResult(`❌ 로그인 실패: ${data.error}`)
      }
    } catch (err) {
      setAuthResult(`❌ 오류: ${err}`)
    } finally {
      setIsLoading(false)
    }
  }

  // 5. 로그인 테스트 (관리자)
  const testAdminLogin = async () => {
    setIsLoading(true)
    setAuthResult('관리자 로그인 테스트 중...')
    
    try {
      const response = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: '관리자',
          className: 'admin',
          pin: '0000'
        })
      })

      const data = await response.json()
      
      if (response.ok) {
        setCurrentUser(data.user)
        setAuthResult(`✅ 관리자 로그인 성공!\n사용자: ${data.user.name} (${data.user.role})`)
      } else {
        setAuthResult(`❌ 로그인 실패: ${data.error}`)
      }
    } catch (err) {
      setAuthResult(`❌ 오류: ${err}`)
    } finally {
      setIsLoading(false)
    }
  }

  // 6. 현재 사용자 정보 확인
  const checkCurrentUser = async () => {
    setIsLoading(true)
    setAuthResult('현재 사용자 확인 중...')
    
    try {
      const response = await fetch('/api/auth/me', {
        method: 'GET',
        credentials: 'include'
      })

      const data = await response.json()
      
      if (response.ok) {
        setCurrentUser(data.user)
        setAuthResult(`✅ 현재 로그인 사용자: ${data.user.name} (${data.user.role})`)
      } else {
        setCurrentUser(null)
        setAuthResult(`❌ 로그인되지 않음: ${data.error}`)
      }
    } catch (err) {
      setAuthResult(`❌ 오류: ${err}`)
    } finally {
      setIsLoading(false)
    }
  }

  // 7. 관리자 API 테스트 - 계정 조회
  const testAdminAPI = async () => {
    setIsLoading(true)
    setAuthResult('관리자 API 테스트 중...')
    
    try {
      const response = await fetch('/api/admin/accounts', {
        method: 'GET',
        credentials: 'include'
      })

      const data = await response.json()
      
      if (response.ok) {
        setAuthResult(`✅ 관리자 계정 조회 성공!\n계정 수: ${data.accounts?.length || 0}개`)
      } else {
        setAuthResult(`❌ 관리자 API 접근 실패: ${data.error}`)
      }
    } catch (err) {
      setAuthResult(`❌ 오류: ${err}`)
    } finally {
      setIsLoading(false)
    }
  }

  // 8. 새 계정 생성 테스트
  const testCreateAccount = async () => {
    setIsLoading(true)
    setTestResult('계정 생성 테스트 중...')
    
    try {
      const response = await fetch('/api/admin/accounts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          name: '신규학생',
          className: '2-3',
          role: 'student',
          pin: '9999'
        })
      })

      const data = await response.json()
      
      if (response.ok) {
        setTestResult(`✅ 계정 생성 성공!\n생성된 계정: ${data.account.name} (${data.account.role})`)
      } else {
        setTestResult(`❌ 계정 생성 실패: ${data.error}`)
      }
    } catch (err) {
      setTestResult(`❌ 오류: ${err}`)
    } finally {
      setIsLoading(false)
    }
  }

  // 9. 주간 이용권 일괄 발급 테스트
  const testWeeklyTicketIssue = async () => {
    setIsLoading(true)
    setTestResult('주간 이용권 일괄 발급 테스트 중...')
    
    try {
      const response = await fetch('/api/admin/tickets/weekly-issue', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ ticketCount: 10 })
      })

      const data = await response.json()
      
      if (response.ok) {
        setTestResult(`✅ 주간 이용권 일괄 발급 성공!\n${data.message}\n발급 정보: ${JSON.stringify(data.issued, null, 2)}`)
      } else {
        setTestResult(`❌ 주간 이용권 발급 실패: ${data.error}`)
      }
    } catch (err) {
      setTestResult(`❌ 오류: ${err}`)
    } finally {
      setIsLoading(false)
    }
  }

  // 10. 개별 이용권 발급 테스트
  const testIndividualTicketGrant = async () => {
    setIsLoading(true)
    setTestResult('개별 이용권 발급 테스트 중...')
    
    // 먼저 학생 ID를 가져와야 함
    try {
      const accountsResponse = await fetch('/api/admin/accounts', {
        method: 'GET',
        credentials: 'include'
      })
      
      if (!accountsResponse.ok) {
        setTestResult('❌ 계정 정보를 가져올 수 없습니다.')
        return
      }
      
      const accountsData = await accountsResponse.json()
      const students = accountsData.accounts?.filter((acc: any) => acc.role === 'student')
      
      if (!students || students.length === 0) {
        setTestResult('❌ 테스트할 학생 계정이 없습니다.')
        return
      }
      
      const studentId = students[0].id
      
      const response = await fetch('/api/admin/tickets/grant', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          studentId: studentId,
          ticketCount: 5,
          reason: '테스트 발급'
        })
      })

      const data = await response.json()
      
      if (response.ok) {
        setTestResult(`✅ 개별 이용권 발급 성공!\n${data.message}\n발급 정보: ${JSON.stringify(data.grant, null, 2)}`)
      } else {
        setTestResult(`❌ 개별 이용권 발급 실패: ${data.error}`)
      }
    } catch (err) {
      setTestResult(`❌ 오류: ${err}`)
    } finally {
      setIsLoading(false)
    }
  }

  // 11. 관리자 대시보드 접근 테스트
  const testAdminDashboard = async () => {
    setAuthResult('관리자 대시보드 접근 테스트...')
    try {
      window.open('/dashboard/admin', '_blank')
      setAuthResult('✅ 관리자 대시보드가 새 탭에서 열렸습니다.')
    } catch (err) {
      setAuthResult(`❌ 오류: ${err}`)
    }
  }

  // 12. 최대 이용권 제한 테스트 (15장 시도)
  const testMaxTicketLimit = async () => {
    setIsLoading(true)
    setTestResult('최대 이용권 제한 테스트 중...')
    
    // 먼저 학생 ID를 가져와야 함
    try {
      const accountsResponse = await fetch('/api/admin/accounts', {
        method: 'GET',
        credentials: 'include'
      })
      
      if (!accountsResponse.ok) {
        setTestResult('❌ 계정 정보를 가져올 수 없습니다.')
        return
      }
      
      const accountsData = await accountsResponse.json()
      const students = accountsData.accounts?.filter((acc: any) => acc.role === 'student')
      
      if (!students || students.length === 0) {
        setTestResult('❌ 테스트할 학생 계정이 없습니다.')
        return
      }
      
      const studentId = students[0].id
      
      const response = await fetch('/api/admin/tickets/grant', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          studentId: studentId,
          ticketCount: 15, // 최대 10장을 넘는 15장 시도
          reason: '최대 제한 테스트 (15장 시도)'
        })
      })

      const data = await response.json()
      
      if (response.ok) {
        const finalTickets = data.grant.student.currentTickets
        if (finalTickets <= 10) {
          setTestResult(`✅ 최대 제한 테스트 성공!\n15장 시도했지만 최대 10장으로 제한됨\n최종 보유: ${finalTickets}장\n${JSON.stringify(data.grant, null, 2)}`)
        } else {
          setTestResult(`❌ 최대 제한 실패: ${finalTickets}장 보유 (10장 초과)`)
        }
      } else {
        setTestResult(`❌ 최대 제한 테스트 실패: ${data.error}`)
      }
    } catch (err) {
      setTestResult(`❌ 오류: ${err}`)
    } finally {
      setIsLoading(false)
    }
  }

  // 12. 로그아웃 테스트
  const testLogout = async () => {
    setIsLoading(true)
    setAuthResult('로그아웃 테스트 중...')
    
    try {
      const response = await fetch('/api/auth/logout', {
        method: 'POST',
        credentials: 'include'
      })

      const data = await response.json()
      
      if (response.ok) {
        setCurrentUser(null)
        setAuthResult(`✅ 로그아웃 성공: ${data.message}`)
      } else {
        setAuthResult(`❌ 로그아웃 실패: ${data.error}`)
      }
    } catch (err) {
      setAuthResult(`❌ 오류: ${err}`)
    } finally {
      setIsLoading(false)
    }
  }

  // ================== Task 4 예약 시스템 테스트 ==================

  // 13. 주간 슬롯 생성 테스트
  const testCreateWeeklySlots = async () => {
    setIsLoading(true)
    setSlotResult('주간 슬롯 생성 테스트 중...')
    
    try {
      const response = await fetch('/api/admin/slots', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          week: '2025-02', // 2025년 2주차
          teacherId: 14, // 김선생 ID (테스트 데이터에서)
          blocks: [
            { dayOfWeek: 1, blockNumber: 1, maxCapacity: 1 }, // 월요일 1교시
            { dayOfWeek: 1, blockNumber: 2, maxCapacity: 1 }, // 월요일 2교시
            { dayOfWeek: 2, blockNumber: 3, maxCapacity: 1 }, // 화요일 3교시
            { dayOfWeek: 2, blockNumber: 7, maxCapacity: 1 }, // 화요일 7교시 (오후)
            { dayOfWeek: 3, blockNumber: 1, maxCapacity: 1 }, // 수요일 1교시
          ]
        })
      })

      const data = await response.json()
      
      if (response.ok) {
        setSlotResult(`✅ 주간 슬롯 생성 성공!\n${data.message}\n생성된 슬롯:\n${JSON.stringify(data.slots, null, 2)}`)
      } else {
        setSlotResult(`❌ 주간 슬롯 생성 실패: ${data.error}`)
      }
    } catch (err) {
      setSlotResult(`❌ 오류: ${err}`)
    } finally {
      setIsLoading(false)
    }
  }

  // 14. 주간 슬롯 조회 테스트
  const testGetWeeklySlots = async () => {
    setIsLoading(true)
    setSlotResult('주간 슬롯 조회 테스트 중...')
    
    try {
      const response = await fetch('/api/admin/slots?week=2025-02', {
        method: 'GET',
        credentials: 'include'
      })

      const data = await response.json()
      
      if (response.ok) {
        setSlotResult(`✅ 주간 슬롯 조회 성공!\n주차: ${data.week}\n날짜 범위: ${data.dateRange.startDate} ~ ${data.dateRange.endDate}\n슬롯 수: ${data.slots?.length || 0}개\n\n슬롯 목록:\n${JSON.stringify(data.slots, null, 2)}`)
      } else {
        setSlotResult(`❌ 주간 슬롯 조회 실패: ${data.error}`)
      }
    } catch (err) {
      setSlotResult(`❌ 오류: ${err}`)
    } finally {
      setIsLoading(false)
    }
  }

  // 15. 예약 생성 테스트 (이용권 차감)
  const testCreateReservation = async () => {
    setIsLoading(true)
    setReservationResult('예약 생성 테스트 중...')
    
    try {
      // 먼저 슬롯 조회해서 첫 번째 슬롯 ID 가져오기
      const slotsResponse = await fetch('/api/admin/slots?week=2025-02', {
        method: 'GET',
        credentials: 'include'
      })
      
      const slotsData = await slotsResponse.json()
      
      if (!slotsResponse.ok || !slotsData.slots?.length) {
        setReservationResult('❌ 예약할 슬롯을 찾을 수 없습니다. 먼저 슬롯을 생성해주세요.')
        return
      }
      
      const firstSlotId = slotsData.slots[0].id
      
      const response = await fetch('/api/reservations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          slotId: firstSlotId,
          // studentId는 관리자가 다른 학생 대신 예약할 때만 필요
          studentId: currentUser?.role === 'admin' ? 13 : undefined // 테스트학생 ID
        })
      })

      const data = await response.json()
      
      if (response.ok) {
        setReservationResult(`✅ 예약 생성 성공!\n${data.message}\n차감된 이용권: ${data.ticketsDeducted}장\n남은 이용권: ${data.remainingTickets}장\n\n예약 정보:\n${JSON.stringify(data.reservation, null, 2)}`)
      } else {
        setReservationResult(`❌ 예약 생성 실패: ${data.error}`)
      }
    } catch (err) {
      setReservationResult(`❌ 오류: ${err}`)
    } finally {
      setIsLoading(false)
    }
  }

  // 16. 예약 규칙 위반 테스트 (일일 최대 3회)
  const testReservationRuleViolation = async () => {
    setIsLoading(true)
    setReservationResult('예약 규칙 위반 테스트 중 (일일 4회 시도)...')
    
    try {
      const slotsResponse = await fetch('/api/admin/slots?week=2025-02', {
        credentials: 'include'
      })
      const slotsData = await slotsResponse.json()
      
      if (!slotsResponse.ok || !slotsData.slots?.length) {
        setReservationResult('❌ 테스트할 슬롯을 찾을 수 없습니다.')
        return
      }
      
      let results = []
      
      // 같은 날짜의 슬롯들 찾기
      const sameDateSlots = slotsData.slots.filter((slot: any) => slot.date === slotsData.slots[0].date)
      
      for (let i = 0; i < Math.min(4, sameDateSlots.length); i++) {
        const response = await fetch('/api/reservations', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify({
            slotId: sameDateSlots[i].id,
            studentId: currentUser?.role === 'admin' ? 13 : undefined
          })
        })
        
        const data = await response.json()
        
        if (response.ok) {
          results.push(`${i + 1}회째: ✅ 성공`)
        } else {
          results.push(`${i + 1}회째: ❌ ${data.error}`)
        }
      }
      
      setReservationResult(`📋 예약 규칙 위반 테스트 결과:\n${results.join('\n')}\n\n💡 4회째 예약에서 "일일 예약 한도(3회)를 초과했습니다" 오류가 나와야 정상입니다.`)
    } catch (err) {
      setReservationResult(`❌ 오류: ${err}`)
    } finally {
      setIsLoading(false)
    }
  }

  // 17. 예약 조회 테스트
  const testGetReservations = async () => {
    setIsLoading(true)
    setReservationResult('예약 조회 테스트 중...')
    
    try {
      const response = await fetch('/api/reservations', {
        method: 'GET',
        credentials: 'include'
      })

      const data = await response.json()
      
      if (response.ok) {
        setReservationResult(`✅ 예약 조회 성공!\n예약 수: ${data.reservations?.length || 0}개\n\n예약 목록:\n${JSON.stringify(data.reservations, null, 2)}`)
      } else {
        setReservationResult(`❌ 예약 조회 실패: ${data.error}`)
      }
    } catch (err) {
      setReservationResult(`❌ 오류: ${err}`)
    } finally {
      setIsLoading(false)
    }
  }

  // 18. 예약 수정 테스트
  const testUpdateReservation = async () => {
    setIsLoading(true)
    setReservationResult('예약 수정 테스트 중...')
    
    try {
      // 먼저 예약 목록 가져오기
      const reservationsResponse = await fetch('/api/reservations', {
        credentials: 'include'
      })
      const reservationsData = await reservationsResponse.json()
      
      if (!reservationsResponse.ok || !reservationsData.reservations?.length) {
        setReservationResult('❌ 수정할 예약을 찾을 수 없습니다. 먼저 예약을 생성해주세요.')
        return
      }
      
      const firstReservation = reservationsData.reservations[0]
      
      // 다른 슬롯 찾기
      const slotsResponse = await fetch('/api/admin/slots?week=2025-02', {
        credentials: 'include'
      })
      const slotsData = await slotsResponse.json()
      
      if (!slotsResponse.ok || !slotsData.slots?.length) {
        setReservationResult('❌ 변경할 슬롯을 찾을 수 없습니다.')
        return
      }
      
      const differentSlot = slotsData.slots.find((slot: any) => slot.id !== firstReservation.slot_id)
      
      if (!differentSlot) {
        setReservationResult('❌ 변경할 다른 슬롯이 없습니다.')
        return
      }
      
      const response = await fetch(`/api/reservations/${firstReservation.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          newSlotId: differentSlot.id
        })
      })

      const data = await response.json()
      
      if (response.ok) {
        setReservationResult(`✅ 예약 수정 성공!\n${data.message}\n\n수정된 예약:\n${JSON.stringify(data.reservation, null, 2)}`)
      } else {
        setReservationResult(`❌ 예약 수정 실패: ${data.error}`)
      }
    } catch (err) {
      setReservationResult(`❌ 오류: ${err}`)
    } finally {
      setIsLoading(false)
    }
  }

  // 19. 예약 취소 테스트 (티켓 환불)
  const testCancelReservation = async () => {
    setIsLoading(true)
    setReservationResult('예약 취소 테스트 중...')
    
    try {
      // 예약 목록 가져오기
      const reservationsResponse = await fetch('/api/reservations', {
        credentials: 'include'
      })
      const reservationsData = await reservationsResponse.json()
      
      if (!reservationsResponse.ok || !reservationsData.reservations?.length) {
        setReservationResult('❌ 취소할 예약을 찾을 수 없습니다.')
        return
      }
      
      const firstReservation = reservationsData.reservations[0]
      
      const response = await fetch(`/api/reservations/${firstReservation.id}`, {
        method: 'DELETE',
        credentials: 'include'
      })

      const data = await response.json()
      
      if (response.ok) {
        setReservationResult(`✅ 예약 취소 성공!\n${data.message}\n환불된 이용권: ${data.ticketsRefunded}장`)
      } else {
        setReservationResult(`❌ 예약 취소 실패: ${data.error}`)
      }
    } catch (err) {
      setReservationResult(`❌ 오류: ${err}`)
    } finally {
      setIsLoading(false)
    }
  }

  // ================== Task 5 문제 관리 시스템 테스트 ==================

  // 20. 문제 생성 테스트 (교사)
  const testCreateProblem = async () => {
    setIsLoading(true)
    setProblemResult('문제 생성 테스트 중...')
    
    try {
      const response = await fetch('/api/teacher/problems', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          title: '이차함수의 그래프 문제',
          content: 'y = ax² + bx + c에서 a = 2, b = -4, c = 1일 때 최솟값을 구하시오.',
          difficulty_level: 3,
          subject_area: '수학2',
          preview_lead_time: 30 // 30분 사전열람
        })
      })

      const data = await response.json()
      
      if (response.ok) {
        setProblemResult(`✅ 문제 생성 성공!\n문제 ID: ${data.problem.id}\n제목: ${data.problem.title}\n상태: ${data.problem.status}\n사전열람 시간: ${data.problem.preview_lead_time}분`)
      } else {
        setProblemResult(`❌ 문제 생성 실패: ${data.error}`)
      }
    } catch (err) {
      setProblemResult(`❌ 오류: ${err}`)
    } finally {
      setIsLoading(false)
    }
  }

  // 21. 문제 목록 조회 테스트 (교사)
  const testGetProblems = async () => {
    setIsLoading(true)
    setProblemResult('문제 목록 조회 테스트 중...')
    
    try {
      const response = await fetch('/api/teacher/problems', {
        method: 'GET',
        credentials: 'include'
      })

      const data = await response.json()
      
      if (response.ok) {
        const problems = data.problems || []
        setProblemResult(`✅ 문제 목록 조회 성공!\n총 문제 수: ${problems.length}개\n\n문제 목록:\n${JSON.stringify(problems, null, 2)}`)
      } else {
        setProblemResult(`❌ 문제 목록 조회 실패: ${data.error}`)
      }
    } catch (err) {
      setProblemResult(`❌ 오류: ${err}`)
    } finally {
      setIsLoading(false)
    }
  }

  // 22. 문제 공개 테스트
  const testPublishProblem = async () => {
    setIsLoading(true)
    setProblemResult('문제 공개 테스트 중...')
    
    try {
      // 먼저 문제 목록 조회해서 첫 번째 draft 문제 찾기
      const listResponse = await fetch('/api/teacher/problems', {
        credentials: 'include'
      })
      const listData = await listResponse.json()
      
      if (!listResponse.ok || !listData.problems?.length) {
        setProblemResult('❌ 공개할 문제를 찾을 수 없습니다. 먼저 문제를 생성해주세요.')
        return
      }
      
      const draftProblem = listData.problems.find((p: any) => p.status === 'draft')
      if (!draftProblem) {
        setProblemResult('❌ 초안 상태의 문제가 없습니다. 먼저 문제를 생성해주세요.')
        return
      }
      
      const response = await fetch(`/api/teacher/problems/${draftProblem.id}/publish`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          // 예약 공개 시간 (선택사항)
          // scheduled_publish_at: new Date(Date.now() + 60000).toISOString() // 1분 후
        })
      })

      const data = await response.json()
      
      if (response.ok) {
        setProblemResult(`✅ 문제 공개 성공!\n문제 ID: ${draftProblem.id}\n제목: ${draftProblem.title}\n상태: ${data.problem.status}\n공개 시간: ${data.problem.updated_at}`)
      } else {
        setProblemResult(`❌ 문제 공개 실패: ${data.error}`)
      }
    } catch (err) {
      setProblemResult(`❌ 오류: ${err}`)
    } finally {
      setIsLoading(false)
    }
  }

  // 23. 문제 복제 테스트
  const testDuplicateProblem = async () => {
    setIsLoading(true)
    setProblemResult('문제 복제 테스트 중...')
    
    try {
      // 먼저 문제 목록 조회해서 첫 번째 문제 찾기
      const listResponse = await fetch('/api/teacher/problems', {
        credentials: 'include'
      })
      const listData = await listResponse.json()
      
      if (!listResponse.ok || !listData.problems?.length) {
        setProblemResult('❌ 복제할 문제를 찾을 수 없습니다. 먼저 문제를 생성해주세요.')
        return
      }
      
      const originalProblem = listData.problems[0]
      
      const response = await fetch(`/api/teacher/problems/${originalProblem.id}/duplicate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          title: '이차함수의 그래프 문제 (수정본)' // 커스텀 제목 (선택사항)
        })
      })

      const data = await response.json()
      
      if (response.ok) {
        setProblemResult(`✅ 문제 복제 성공!\n원본 문제: ${data.originalProblem.title} (ID: ${data.originalProblem.id})\n복제 문제: ${data.duplicatedProblem.title} (ID: ${data.duplicatedProblem.id})\n복제본 상태: ${data.duplicatedProblem.status}`)
      } else {
        setProblemResult(`❌ 문제 복제 실패: ${data.error}`)
      }
    } catch (err) {
      setProblemResult(`❌ 오류: ${err}`)
    } finally {
      setIsLoading(false)
    }
  }

  // 24. 학생 문제 사전열람 가능 여부 테스트
  const testStudentProblemAvailability = async () => {
    setIsLoading(true)
    setProblemResult('학생 문제 사전열람 테스트 중...')
    
    try {
      // 먼저 공개된 문제와 예약 정보 필요
      const problemsResponse = await fetch('/api/teacher/problems', {
        credentials: 'include'
      })
      const problemsData = await problemsResponse.json()
      
      const publishedProblem = problemsData.problems?.find((p: any) => p.status === 'published')
      if (!publishedProblem) {
        setProblemResult('❌ 공개된 문제가 없습니다. 먼저 문제를 공개해주세요.')
        return
      }
      
      // 예약 정보 가져오기
      const reservationsResponse = await fetch('/api/reservations', {
        credentials: 'include'
      })
      const reservationsData = await reservationsResponse.json()
      
      if (!reservationsResponse.ok || !reservationsData.reservations?.length) {
        setProblemResult('❌ 활성 예약이 없습니다. 먼저 예약을 생성해주세요.')
        return
      }
      
      const reservation = reservationsData.reservations[0]
      
      const response = await fetch(`/api/student/problems/${publishedProblem.id}/availability?reservationId=${reservation.id}`, {
        method: 'GET',
        credentials: 'include'
      })

      const data = await response.json()
      
      if (response.ok) {
        const schedule = data.schedule
        setProblemResult(`✅ 학생 사전열람 확인 성공!\n문제 ID: ${publishedProblem.id}\n예약 ID: ${reservation.id}\n\n📊 사전열람 상태:\n- 열람 가능: ${data.canView ? '✅ 가능' : '❌ 불가능'}\n- 사유: ${data.reason}\n- 대기 순번: ${schedule?.queuePosition}번\n- 예약 시작 시간: ${schedule?.scheduledStartAt}\n- 사전열람까지: ${Math.round(schedule?.timeUntilVisible / 60000)}분\n- 수업 시작까지: ${Math.round(schedule?.timeUntilStart / 60000)}분`)
      } else {
        setProblemResult(`❌ 사전열람 확인 실패: ${data.error}`)
      }
    } catch (err) {
      setProblemResult(`❌ 오류: ${err}`)
    } finally {
      setIsLoading(false)
    }
  }

  // 25. 문제 아카이브 테스트
  const testArchiveProblem = async () => {
    setIsLoading(true)
    setProblemResult('문제 아카이브 테스트 중...')
    
    try {
      // 공개된 문제 찾기
      const listResponse = await fetch('/api/teacher/problems', {
        credentials: 'include'
      })
      const listData = await listResponse.json()
      
      const publishedProblem = listData.problems?.find((p: any) => p.status === 'published')
      if (!publishedProblem) {
        setProblemResult('❌ 아카이브할 공개된 문제가 없습니다. 먼저 문제를 공개해주세요.')
        return
      }
      
      const response = await fetch(`/api/teacher/problems/${publishedProblem.id}/archive`, {
        method: 'POST',
        credentials: 'include'
      })

      const data = await response.json()
      
      if (response.ok) {
        setProblemResult(`✅ 문제 아카이브 성공!\n문제 ID: ${publishedProblem.id}\n제목: ${publishedProblem.title}\n상태: ${data.problem.status}\n아카이브 시간: ${data.problem.updated_at}`)
      } else {
        setProblemResult(`❌ 문제 아카이브 실패: ${data.error}`)
      }
    } catch (err) {
      setProblemResult(`❌ 오류: ${err}`)
    } finally {
      setIsLoading(false)
    }
  }

  // 26. 자동 공개 스케줄러 테스트 (관리자)
  const testScheduler = async () => {
    setIsLoading(true)
    setSchedulerResult('스케줄러 테스트 중...')
    
    try {
      // 먼저 스케줄러 상태 확인
      const statusResponse = await fetch('/api/admin/scheduler', {
        method: 'GET',
        credentials: 'include'
      })
      const statusData = await statusResponse.json()
      
      let result = ''
      
      if (statusResponse.ok) {
        result += `📊 스케줄러 상태:\n- 대기 중인 문제: ${statusData.status.pendingCount}개\n- 다음 예약 시간: ${statusData.status.nextScheduledAt || '없음'}\n\n`
      }
      
      // 수동 스케줄러 실행
      const runResponse = await fetch('/api/admin/scheduler', {
        method: 'POST',
        credentials: 'include'
      })
      const runData = await runResponse.json()
      
      if (runResponse.ok) {
        result += `✅ 스케줄러 수동 실행 성공!\n- 처리된 문제: ${runData.result.processedCount}개\n- 공개된 문제: ${runData.result.publishedCount}개\n- 오류 수: ${runData.result.errorCount}개\n- 실행 시간: ${runData.result.executionTimeMs}ms\n\n공개된 문제 ID: ${runData.result.publishedProblems.join(', ') || '없음'}`
        
        if (runData.result.errors.length > 0) {
          result += `\n\n❌ 오류 내용:\n${JSON.stringify(runData.result.errors, null, 2)}`
        }
      } else {
        result += `❌ 스케줄러 실행 실패: ${runData.error}`
      }
      
      setSchedulerResult(result)
    } catch (err) {
      setSchedulerResult(`❌ 오류: ${err}`)
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <main className="container mx-auto p-8 max-w-7xl">
      <h1 className="text-3xl font-bold mb-8">Last Days MVP 기능 테스트 (Task 3 포함)</h1>
      
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* 데이터베이스 테스트 */}
        <div className="bg-white p-6 rounded-lg shadow-md">
          <h2 className="text-xl font-semibold mb-4">1. 데이터베이스 연결</h2>
          <button 
            onClick={testConnection}
            disabled={isLoading}
            className="bg-blue-500 hover:bg-blue-600 disabled:bg-gray-400 text-white px-3 py-2 rounded mr-2 mb-2 text-sm"
          >
            연결 테스트
          </button>
          <button 
            onClick={insertTestData}
            disabled={isLoading}
            className="bg-green-500 hover:bg-green-600 disabled:bg-gray-400 text-white px-3 py-2 rounded mb-2 text-sm"
          >
            테스트 데이터 삽입
          </button>
          {(connectionStatus || testResult) && (
            <div className="mt-4 p-3 bg-gray-100 rounded">
              <pre className="font-mono text-xs whitespace-pre-wrap">
                {connectionStatus}
                {testResult && `\n\n${testResult}`}
              </pre>
            </div>
          )}
        </div>

        {/* 인증 시스템 테스트 */}
        <div className="bg-white p-6 rounded-lg shadow-md">
          <h2 className="text-xl font-semibold mb-4">2. 인증 시스템</h2>
          <div className="space-x-2 space-y-2">
            <button 
              onClick={testStudentLogin}
              disabled={isLoading}
              className="bg-blue-500 hover:bg-blue-600 disabled:bg-gray-400 text-white px-3 py-2 rounded text-sm"
            >
              학생 로그인
            </button>
            <button 
              onClick={testTeacherLogin}
              disabled={isLoading}
              className="bg-purple-500 hover:bg-purple-600 disabled:bg-gray-400 text-white px-3 py-2 rounded text-sm"
            >
              교사 로그인
            </button>
            <button 
              onClick={testAdminLogin}
              disabled={isLoading}
              className="bg-red-500 hover:bg-red-600 disabled:bg-gray-400 text-white px-3 py-2 rounded text-sm"
            >
              관리자 로그인
            </button>
            <button 
              onClick={checkCurrentUser}
              disabled={isLoading}
              className="bg-gray-500 hover:bg-gray-600 disabled:bg-gray-400 text-white px-3 py-2 rounded text-sm"
            >
              현재 사용자 확인
            </button>
            <button 
              onClick={testLogout}
              disabled={isLoading}
              className="bg-orange-500 hover:bg-orange-600 disabled:bg-gray-400 text-white px-3 py-2 rounded text-sm"
            >
              로그아웃
            </button>
          </div>
          {authResult && (
            <div className="mt-4 p-3 bg-gray-100 rounded">
              <pre className="font-mono text-sm whitespace-pre-wrap">{authResult}</pre>
            </div>
          )}
        </div>

        {/* 관리자 계정 CRUD 테스트 */}
        <div className="bg-white p-6 rounded-lg shadow-md">
          <h2 className="text-xl font-semibold mb-4">3. 관리자 계정 관리 (Task 3.1)</h2>
          <button 
            onClick={testAdminAPI}
            disabled={isLoading}
            className="bg-red-500 hover:bg-red-600 disabled:bg-gray-400 text-white px-3 py-2 rounded mb-2 mr-2 text-sm"
          >
            계정 조회
          </button>
          <button 
            onClick={testCreateAccount}
            disabled={isLoading}
            className="bg-green-500 hover:bg-green-600 disabled:bg-gray-400 text-white px-3 py-2 rounded mb-2 text-sm"
          >
            계정 생성
          </button>
          <div className="text-sm text-gray-600 mb-2">
            관리자로 로그인 후 테스트하세요.
          </div>
        </div>

        {/* 이용권 관리 테스트 */}
        <div className="bg-white p-6 rounded-lg shadow-md">
          <h2 className="text-xl font-semibold mb-4">4. 이용권 관리 (Task 3.2, 3.3)</h2>
          <button 
            onClick={testWeeklyTicketIssue}
            disabled={isLoading}
            className="bg-purple-500 hover:bg-purple-600 disabled:bg-gray-400 text-white px-3 py-2 rounded mb-2 mr-2 text-sm"
          >
            주간 일괄 발급
          </button>
          <button 
            onClick={testIndividualTicketGrant}
            disabled={isLoading}
            className="bg-orange-500 hover:bg-orange-600 disabled:bg-gray-400 text-white px-3 py-2 rounded mb-2 mr-2 text-sm"
          >
            개별 발급 (5장)
          </button>
          <button 
            onClick={testMaxTicketLimit}
            disabled={isLoading}
            className="bg-red-500 hover:bg-red-600 disabled:bg-gray-400 text-white px-3 py-2 rounded mb-2 text-sm"
          >
            최대 제한 테스트 (15장 시도)
          </button>
          <div className="text-sm text-gray-600 mb-2">
            관리자로 로그인 후 학생이 있어야 테스트 가능합니다.
          </div>
          <div className="text-xs text-red-600 mb-2">
            ⚠️ 개인당 최대 10장까지만 보유 가능
          </div>
        </div>

        {/* 관리자 대시보드 테스트 */}
        <div className="bg-white p-6 rounded-lg shadow-md">
          <h2 className="text-xl font-semibold mb-4">5. 관리자 대시보드 (Task 3.4)</h2>
          <button 
            onClick={testAdminDashboard}
            disabled={isLoading}
            className="bg-indigo-500 hover:bg-indigo-600 disabled:bg-gray-400 text-white px-3 py-2 rounded mb-2 text-sm"
          >
            대시보드 열기
          </button>
          <div className="text-sm text-gray-600 mb-2">
            관리자로 로그인 후 새 탭에서 대시보드가 열립니다.
          </div>
        </div>

        {/* 현재 상태 */}
        <div className="bg-white p-6 rounded-lg shadow-md">
          <h2 className="text-xl font-semibold mb-4">6. 현재 상태</h2>
          {currentUser ? (
            <div className="bg-green-50 border border-green-200 p-4 rounded">
              <h3 className="font-semibold text-green-800">로그인 중</h3>
              <p className="text-green-700 text-sm">이름: {currentUser.name}</p>
              <p className="text-green-700 text-sm">반: {currentUser.className}</p>
              <p className="text-green-700 text-sm">역할: {currentUser.role}</p>
              {currentUser.role === 'admin' && (
                <div className="mt-2 p-2 bg-red-100 rounded">
                  <p className="text-red-700 text-xs font-semibold">✅ 관리자 권한으로 모든 기능 테스트 가능</p>
                </div>
              )}
            </div>
          ) : (
            <div className="bg-gray-50 border border-gray-200 p-4 rounded">
              <p className="text-gray-600 text-sm">로그인되지 않음</p>
            </div>
          )}
        </div>

        {/* Task 4: 슬롯 관리 시스템 테스트 */}
        <div className="bg-white p-6 rounded-lg shadow-md">
          <h2 className="text-xl font-semibold mb-4">7. 슬롯 관리 (Task 4.1)</h2>
          <button 
            onClick={testCreateWeeklySlots}
            disabled={isLoading}
            className="bg-indigo-500 hover:bg-indigo-600 disabled:bg-gray-400 text-white px-3 py-2 rounded mb-2 mr-2 text-sm"
          >
            주간 슬롯 생성
          </button>
          <button 
            onClick={testGetWeeklySlots}
            disabled={isLoading}
            className="bg-cyan-500 hover:bg-cyan-600 disabled:bg-gray-400 text-white px-3 py-2 rounded mb-2 text-sm"
          >
            주간 슬롯 조회
          </button>
          <div className="text-sm text-gray-600 mb-2">
            관리자로 로그인 후 테스트하세요. 2025년 2주차 슬롯을 생성/조회합니다.
          </div>
          {slotResult && (
            <div className="mt-4 p-3 bg-gray-100 rounded">
              <pre className="font-mono text-sm whitespace-pre-wrap">{slotResult}</pre>
            </div>
          )}
        </div>

        {/* Task 4: 예약 생성 및 규칙 검증 */}
        <div className="bg-white p-6 rounded-lg shadow-md">
          <h2 className="text-xl font-semibold mb-4">8. 예약 시스템 (Task 4.2-4.4)</h2>
          <button 
            onClick={testCreateReservation}
            disabled={isLoading}
            className="bg-emerald-500 hover:bg-emerald-600 disabled:bg-gray-400 text-white px-3 py-2 rounded mb-2 mr-2 text-sm"
          >
            예약 생성
          </button>
          <button 
            onClick={testReservationRuleViolation}
            disabled={isLoading}
            className="bg-amber-500 hover:bg-amber-600 disabled:bg-gray-400 text-white px-3 py-2 rounded mb-2 mr-2 text-sm"
          >
            규칙 위반 테스트
          </button>
          <button 
            onClick={testGetReservations}
            disabled={isLoading}
            className="bg-slate-500 hover:bg-slate-600 disabled:bg-gray-400 text-white px-3 py-2 rounded mb-2 text-sm"
          >
            예약 조회
          </button>
          <div className="text-sm text-gray-600 mb-2">
            먼저 슬롯을 생성하고 이용권이 있는 학생으로 로그인하거나 관리자로 테스트하세요.
          </div>
          <div className="text-xs text-amber-600 mb-2">
            ⚠️ 규칙: 일일 최대 3회, 오전/오후 교차 불가, 동일 교사 2회 제한
          </div>
          {reservationResult && (
            <div className="mt-4 p-3 bg-gray-100 rounded">
              <pre className="font-mono text-sm whitespace-pre-wrap">{reservationResult}</pre>
            </div>
          )}
        </div>

        {/* Task 4: 예약 수정 및 취소 */}
        <div className="bg-white p-6 rounded-lg shadow-md">
          <h2 className="text-xl font-semibold mb-4">9. 예약 수정/취소 (Task 4.5)</h2>
          <button 
            onClick={testUpdateReservation}
            disabled={isLoading}
            className="bg-violet-500 hover:bg-violet-600 disabled:bg-gray-400 text-white px-3 py-2 rounded mb-2 mr-2 text-sm"
          >
            예약 수정
          </button>
          <button 
            onClick={testCancelReservation}
            disabled={isLoading}
            className="bg-rose-500 hover:bg-rose-600 disabled:bg-gray-400 text-white px-3 py-2 rounded mb-2 text-sm"
          >
            예약 취소
          </button>
          <div className="text-sm text-gray-600 mb-2">
            예약이 있어야 테스트할 수 있습니다. 전날까지만 수정 가능합니다.
          </div>
          <div className="text-xs text-green-600 mb-2">
            💰 취소 시 이용권이 환불됩니다.
          </div>
        </div>

        {/* Task 5: 교사 문제 관리 */}
        <div className="bg-white p-6 rounded-lg shadow-md">
          <h2 className="text-xl font-semibold mb-4">10. 교사 문제 관리 (Task 5.1-5.2)</h2>
          <button 
            onClick={testCreateProblem}
            disabled={isLoading}
            className="bg-blue-500 hover:bg-blue-600 disabled:bg-gray-400 text-white px-3 py-2 rounded mb-2 mr-2 text-sm"
          >
            문제 생성
          </button>
          <button 
            onClick={testGetProblems}
            disabled={isLoading}
            className="bg-cyan-500 hover:bg-cyan-600 disabled:bg-gray-400 text-white px-3 py-2 rounded mb-2 mr-2 text-sm"
          >
            문제 목록 조회
          </button>
          <button 
            onClick={testPublishProblem}
            disabled={isLoading}
            className="bg-emerald-500 hover:bg-emerald-600 disabled:bg-gray-400 text-white px-3 py-2 rounded mb-2 text-sm"
          >
            문제 공개
          </button>
          <div className="text-sm text-gray-600 mb-2">
            교사로 로그인 후 테스트하세요. 초안 → 공개 → 아카이브 순서로 진행됩니다.
          </div>
          {problemResult && (
            <div className="mt-4 p-3 bg-gray-100 rounded">
              <pre className="font-mono text-sm whitespace-pre-wrap">{problemResult}</pre>
            </div>
          )}
        </div>

        {/* Task 5: 문제 복제 및 아카이브 */}
        <div className="bg-white p-6 rounded-lg shadow-md">
          <h2 className="text-xl font-semibold mb-4">11. 문제 복제/아카이브 (Task 5.5)</h2>
          <button 
            onClick={testDuplicateProblem}
            disabled={isLoading}
            className="bg-purple-500 hover:bg-purple-600 disabled:bg-gray-400 text-white px-3 py-2 rounded mb-2 mr-2 text-sm"
          >
            문제 복제
          </button>
          <button 
            onClick={testArchiveProblem}
            disabled={isLoading}
            className="bg-orange-500 hover:bg-orange-600 disabled:bg-gray-400 text-white px-3 py-2 rounded mb-2 text-sm"
          >
            문제 아카이브
          </button>
          <div className="text-sm text-gray-600 mb-2">
            기존 문제가 있어야 테스트할 수 있습니다. 복제 시 초안 상태로 생성됩니다.
          </div>
          <div className="text-xs text-amber-600 mb-2">
            ⚠️ 진행 중인 세션이 있는 문제는 아카이브할 수 없습니다.
          </div>
        </div>

        {/* Task 5: 학생 사전열람 시스템 */}
        <div className="bg-white p-6 rounded-lg shadow-md">
          <h2 className="text-xl font-semibold mb-4">12. 학생 사전열람 (Task 5.3)</h2>
          <button 
            onClick={testStudentProblemAvailability}
            disabled={isLoading}
            className="bg-indigo-500 hover:bg-indigo-600 disabled:bg-gray-400 text-white px-3 py-2 rounded mb-2 text-sm"
          >
            사전열람 가능 여부 확인
          </button>
          <div className="text-sm text-gray-600 mb-2">
            공개된 문제와 활성 예약이 필요합니다. 대기 순번과 시간이 계산됩니다.
          </div>
          <div className="text-xs text-blue-600 mb-2">
            📊 scheduledStartAt = blockStart + (queuePosition-1)×10분
          </div>
          <div className="text-xs text-green-600 mb-2">
            👁️ canShowProblem = now ≥ scheduledStartAt - preview_lead_minutes
          </div>
        </div>

        {/* Task 5: 자동 공개 스케줄러 */}
        <div className="bg-white p-6 rounded-lg shadow-md">
          <h2 className="text-xl font-semibold mb-4">13. 자동 공개 스케줄러 (Task 5.4)</h2>
          <button 
            onClick={testScheduler}
            disabled={isLoading}
            className="bg-red-500 hover:bg-red-600 disabled:bg-gray-400 text-white px-3 py-2 rounded mb-2 text-sm"
          >
            스케줄러 수동 실행
          </button>
          <div className="text-sm text-gray-600 mb-2">
            관리자로 로그인 후 테스트하세요. 예약된 공개 시간이 지난 문제들을 자동으로 공개합니다.
          </div>
          <div className="text-xs text-red-600 mb-2">
            🤖 실제 운영에서는 cron job이나 서버리스 함수로 주기적 실행됩니다.
          </div>
          {schedulerResult && (
            <div className="mt-4 p-3 bg-gray-100 rounded">
              <pre className="font-mono text-sm whitespace-pre-wrap">{schedulerResult}</pre>
            </div>
          )}
        </div>
      </div>

      <div className="mt-8 bg-blue-50 border border-blue-200 p-6 rounded-lg">
        <h3 className="font-semibold text-blue-800 mb-4">Task 3 관리자 시스템 테스트 시나리오:</h3>
        <ol className="list-decimal list-inside text-blue-700 space-y-2 text-sm">
          <li><strong>초기 설정:</strong> &quot;연결 테스트&quot; → &quot;테스트 데이터 삽입&quot; → &quot;관리자 로그인&quot;</li>
          <li><strong>계정 관리 (Task 3.1):</strong> &quot;계정 조회&quot; → &quot;계정 생성&quot; (신규학생 생성)</li>
          <li><strong>이용권 일괄 발급 (Task 3.2):</strong> &quot;주간 일괄 발급&quot; (모든 학생에게 10장씩)</li>
          <li><strong>개별 이용권 발급 (Task 3.3):</strong> &quot;개별 발급&quot; (특정 학생에게 5장 추가)</li>
          <li><strong>최대 제한 테스트:</strong> &quot;최대 제한 테스트&quot; (15장 시도하여 10장으로 제한되는지 확인)</li>
          <li><strong>관리자 대시보드 (Task 3.4):</strong> &quot;대시보드 열기&quot; (새 탭에서 UI 확인)</li>
          <li><strong>권한 확인:</strong> &quot;로그아웃&quot; → &quot;학생 로그인&quot; → 관리자 기능 접근 시도 (거부 확인)</li>
        </ol>
        
        <div className="mt-4 p-4 bg-white rounded border-l-4 border-blue-400">
          <h4 className="font-semibold text-blue-900 mb-2">추가 테스트 (대시보드에서):</h4>
          <ul className="text-blue-700 text-sm space-y-1">
            <li>• 계정 수정/삭제 기능</li>
            <li>• 이용권 현황 및 통계 확인</li>
            <li>• 반별 현황 보기</li>
            <li>• 개별 학생 이용권 추가 발급</li>
          </ul>
        </div>
      </div>

      <div className="mt-6 bg-green-50 border border-green-200 p-6 rounded-lg">
        <h3 className="font-semibold text-green-800 mb-4">🚀 Task 4 예약 시스템 테스트 시나리오:</h3>
        <ol className="list-decimal list-inside text-green-700 space-y-2 text-sm">
          <li><strong>사전 준비:</strong> &quot;관리자 로그인&quot; → &quot;주간 일괄 발급&quot; (학생들에게 이용권 지급)</li>
          <li><strong>슬롯 생성 (Task 4.1):</strong> &quot;주간 슬롯 생성&quot; → &quot;주간 슬롯 조회&quot; (2025년 2주차)</li>
          <li><strong>예약 생성 (Task 4.2):</strong> &quot;예약 생성&quot; (이용권 즉시 차감 확인)</li>
          <li><strong>규칙 검증 (Task 4.3):</strong> &quot;규칙 위반 테스트&quot; (일일 4회 시도 → 3회 제한 확인)</li>
          <li><strong>예약 관리:</strong> &quot;예약 조회&quot; → &quot;예약 수정&quot; → &quot;예약 취소&quot; (티켓 환불)</li>
          <li><strong>학생 권한 테스트:</strong> &quot;학생 로그인&quot; → &quot;예약 생성&quot; (본인만 예약 가능)</li>
        </ol>
        
        <div className="mt-4 p-4 bg-white rounded border-l-4 border-green-400">
          <h4 className="font-semibold text-green-900 mb-2">🔥 고급 테스트:</h4>
          <ul className="text-green-700 text-sm space-y-1">
            <li>• 오전/오후 교차 예약 시도 (차단 확인)</li>
            <li>• 동일 교사 3회 예약 시도 (2회 제한 확인)</li>
            <li>• 이용권 부족 시 예약 시도 (차단 확인)</li>
            <li>• 전날까지만 수정 가능 확인</li>
            <li>• created_at 기준 순번 계산 확인</li>
          </ul>
        </div>

        <div className="mt-4 p-4 bg-amber-50 border border-amber-200 rounded">
          <h4 className="font-semibold text-amber-800 mb-2">⚠️ 주의사항:</h4>
          <ul className="text-amber-700 text-sm space-y-1">
            <li>• 데이터베이스 함수들이 Supabase에 적용되어야 API가 정상 작동합니다</li>
            <li>• /database/functions.sql 파일의 함수들을 Supabase SQL 편집기에서 실행하세요</li>
            <li>• 테스트 전에 관리자로 로그인하여 이용권을 먼저 발급해주세요</li>
          </ul>
        </div>
      </div>

      <div className="mt-6 bg-purple-50 border border-purple-200 p-6 rounded-lg">
        <h3 className="font-semibold text-purple-800 mb-4">🎯 Task 5 문제 관리 시스템 테스트 시나리오:</h3>
        <ol className="list-decimal list-inside text-purple-700 space-y-2 text-sm">
          <li><strong>교사 설정:</strong> &quot;교사 로그인&quot; → &quot;문제 생성&quot; (이차함수 문제 생성, 30분 사전열람)</li>
          <li><strong>문제 관리 (Task 5.1-5.2):</strong> &quot;문제 목록 조회&quot; → &quot;문제 공개&quot; (draft → published)</li>
          <li><strong>문제 복제 (Task 5.5):</strong> &quot;문제 복제&quot; → &quot;문제 목록 조회&quot; (복제본 확인)</li>
          <li><strong>사전열람 테스트 (Task 5.3):</strong> 예약 생성 → &quot;사전열람 가능 여부 확인&quot; (시간 계산 로직)</li>
          <li><strong>스케줄러 테스트 (Task 5.4):</strong> &quot;관리자 로그인&quot; → &quot;스케줄러 수동 실행&quot;</li>
          <li><strong>아카이브:</strong> &quot;문제 아카이브&quot; (published → archived)</li>
          <li><strong>권한 테스트:</strong> &quot;학생 로그인&quot; → 교사 API 접근 시도 (거부 확인)</li>
        </ol>
        
        <div className="mt-4 p-4 bg-white rounded border-l-4 border-purple-400">
          <h4 className="font-semibold text-purple-900 mb-2">🔬 고급 테스트 (사전열람 로직):</h4>
          <ul className="text-purple-700 text-sm space-y-1">
            <li>• <strong>시간 계산:</strong> scheduledStartAt = blockStart + (queuePosition-1)×10분</li>
            <li>• <strong>열람 가능:</strong> canShowProblem = now ≥ scheduledStartAt - preview_lead_minutes</li>
            <li>• <strong>대기 순번:</strong> 예약 생성 시간(created_at) 기준 정렬</li>
            <li>• <strong>교사 일치:</strong> 예약 교사와 문제 작성자 일치 확인</li>
            <li>• <strong>블록 시간:</strong> 1교시(09:00) ~ 10교시(18:00) 매핑</li>
          </ul>
        </div>

        <div className="mt-4 p-4 bg-amber-50 border border-amber-200 rounded">
          <h4 className="font-semibold text-amber-800 mb-2">⚠️ 테스트 전제조건:</h4>
          <ul className="text-amber-700 text-sm space-y-1">
            <li>• 교사 계정으로 로그인 (김선생/수학교사/5678)</li>
            <li>• 슬롯이 생성되어 있어야 함 (Task 4에서 생성)</li>
            <li>• 학생 예약이 있어야 사전열람 테스트 가능</li>
            <li>• 관리자 권한 필요 (스케줄러 테스트)</li>
          </ul>
        </div>

        <div className="mt-4 p-4 bg-green-50 border border-green-200 rounded">
          <h4 className="font-semibold text-green-800 mb-2">✅ 예상 결과:</h4>
          <ul className="text-green-700 text-sm space-y-1">
            <li>• <strong>문제 생성:</strong> draft 상태로 생성, preview_lead_time 30분 설정</li>
            <li>• <strong>문제 공개:</strong> status가 published로 변경</li>
            <li>• <strong>사전열람:</strong> 시간 계산에 따라 가능/불가능 판단</li>
            <li>• <strong>복제:</strong> 새 ID로 draft 상태 복제본 생성</li>
            <li>• <strong>스케줄러:</strong> 예약된 시간 지난 문제 자동 공개</li>
          </ul>
        </div>
      </div>

      <div className="mt-6 bg-yellow-50 border border-yellow-200 p-6 rounded-lg">
        <h3 className="font-semibold text-yellow-800 mb-4">기본 MVP 테스트 시나리오:</h3>
        <ol className="list-decimal list-inside text-yellow-700 space-y-2 text-sm">
          <li><strong>데이터베이스 연결:</strong> &quot;연결 테스트&quot; → &quot;테스트 데이터 삽입&quot;</li>
          <li><strong>학생 인증:</strong> &quot;학생 로그인&quot; → &quot;현재 사용자 확인&quot;</li>
          <li><strong>교사 인증:</strong> &quot;교사 로그인&quot; → &quot;현재 사용자 확인&quot;</li>
          <li><strong>관리자 권한:</strong> &quot;관리자 로그인&quot; → &quot;계정 조회&quot;</li>
          <li><strong>권한 제어:</strong> 다른 역할로 로그인 후 &quot;계정 조회&quot; (접근 거부 확인)</li>
          <li><strong>세션 관리:</strong> &quot;로그아웃&quot; → &quot;현재 사용자 확인&quot;</li>
        </ol>
      </div>
    </main>
  )
}