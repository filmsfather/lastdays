'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import FeedbackPageClient from './FeedbackPageClient'

interface SessionFeedbackData {
  sessionId: number
  status: string
  startedAt: string
  completedAt: string | null
  student: {
    id: number
    name: string
    className: string
  }
  teacher: {
    id: number
    name: string
    className: string
  }
  slot: {
    date: string
    session_period: string
  }
  scheduling: {
    queuePosition: number
    scheduledStartAt: string
    previewLeadMinutes: number
    canShowProblem: boolean
    timeStatus: 'before_preview' | 'preview_open' | 'waiting_room' | 'interview_ready' | 'session_closed'
  }
  problemSnapshot: {
    id: number
    title: string
    content: string
    limit_minutes: number
    available_date: string
    images: any[]
  } | null
  scores: {
    practical_skills: string
    major_knowledge: string
    major_suitability: string
    attitude: string
  } | null
  teacherFeedback: Array<{
    id: number
    content: string
    feedback_type: string
    created_at: string
  }>
  checklistItems: Array<{
    id: number
    item_text: string
    is_checked: boolean
  }>
  studentReflection: {
    text: string
    updated_at: string
  } | null
}

interface User {
  id: number
  role: string
}

export default function SessionFeedbackPage({
  params
}: {
  params: Promise<{ id: string }>
}) {
  console.log('SessionFeedbackPage component mounted')
  const router = useRouter()
  const [sessionData, setSessionData] = useState<SessionFeedbackData | null>(null)
  const [currentUser, setCurrentUser] = useState<User | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    console.log('Feedback page useEffect started')
    async function fetchData() {
      try {
        console.log('Starting fetchData function')
        setLoading(true)
        setError(null)

        // 인증 확인
        const authResponse = await fetch('/api/auth/me')
        if (!authResponse.ok) {
          router.push('/login')
          return
        }

        const authData = await authResponse.json()
        if (!authData.success || !authData.user) {
          router.push('/login')
          return
        }

        setCurrentUser({
          id: authData.user.id,
          role: authData.user.role
        })

        // 세션 데이터 조회
        const resolvedParams = await params
        const sessionId = parseInt(resolvedParams.id)
        if (isNaN(sessionId)) {
          router.push('/dashboard/student')
          return
        }

        const feedbackResponse = await fetch(`/api/sessions/${sessionId}/feedback-data`)
        if (!feedbackResponse.ok) {
          if (feedbackResponse.status === 401) {
            router.push('/login')
            return
          } else if (feedbackResponse.status === 403) {
            router.push('/dashboard/student/history')
            return
          } else if (feedbackResponse.status === 404) {
            router.push('/dashboard/student/history')
            return
          }
          
          const errorText = await feedbackResponse.text()
          throw new Error(`세션 데이터 조회 실패: ${errorText}`)
        }

        const feedbackData = await feedbackResponse.json()
        if (!feedbackData.success) {
          throw new Error(feedbackData.error || '세션 데이터 조회 실패')
        }

        setSessionData(feedbackData.data)
      } catch (error) {
        console.error('Feedback page error:', error)
        setError(error instanceof Error ? error.message : '알 수 없는 오류가 발생했습니다.')
      } finally {
        setLoading(false)
      }
    }

    fetchData()
  }, [params, router])

  // 임시 테스트용 - 항상 이 내용을 표시
  return (
    <div className="min-h-screen bg-gray-100 flex items-center justify-center">
      <div className="text-center">
        <h1 className="text-2xl font-bold">피드백 페이지 테스트</h1>
        <p>세션 ID: {JSON.stringify(params)}</p>
        <p>로딩 상태: {loading ? '로딩중' : '완료'}</p>
        <p>현재 사용자: {currentUser ? JSON.stringify(currentUser) : '없음'}</p>
      </div>
    </div>
  )

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-100 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500 mx-auto mb-4"></div>
          <p className="text-gray-600">세션 데이터를 불러오는 중...</p>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gray-100 flex items-center justify-center">
        <div className="bg-white rounded-lg shadow-md p-8 text-center max-w-md">
          <div className="text-red-400 mb-4">
            <svg className="mx-auto h-12 w-12" fill="currentColor" viewBox="0 0 24 24">
              <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z"/>
            </svg>
          </div>
          <h3 className="text-lg font-medium text-gray-600 mb-2">오류가 발생했습니다</h3>
          <p className="text-gray-500 mb-4">{error}</p>
          <button 
            onClick={() => window.location.reload()}
            className="px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors mr-2"
          >
            다시 시도
          </button>
          <button 
            onClick={() => router.push('/dashboard/student/history')}
            className="px-4 py-2 bg-gray-500 text-white rounded-lg hover:bg-gray-600 transition-colors"
          >
            히스토리로 돌아가기
          </button>
        </div>
      </div>
    )
  }

  if (!sessionData || !currentUser) {
    return null
  }

  return (
    <FeedbackPageClient 
      sessionData={sessionData}
      currentUser={currentUser}
    />
  )
}