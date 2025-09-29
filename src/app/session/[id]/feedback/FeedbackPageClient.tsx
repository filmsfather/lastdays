'use client'

import React, { useState, useEffect } from 'react'
import { toast } from 'react-hot-toast'
import Link from 'next/link'
import { formatKoreanDate, formatKoreanDateTime } from '@/lib/dateUtils'

interface FeedbackPageProps {
  isHallOfFameMode?: boolean
  sessionData: {
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
      evaluation_type?: string
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
  currentUser: {
    id: number
    role: string
  }
}

// 유틸리티 함수들
const getSessionPeriodTime = (period: string) => {
  return period === 'AM' ? '오전' : '오후'
}

const formatDate = (dateString: string) => {
  const date = new Date(dateString)
  return date.toLocaleDateString('ko-KR', {
    timeZone: 'Asia/Seoul',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    weekday: 'short'
  })
}

const getScoreColor = (score: string) => {
  if (score === '상') return 'text-green-600'
  if (score === '중상') return 'text-blue-600'
  if (score === '중') return 'text-yellow-600'
  if (score === '중하') return 'text-orange-600'
  if (score === '하') return 'text-red-600'
  return 'text-gray-600'
}

// 평가 항목 레이블 매핑
const getEvaluationLabels = (type: 'interview' | 'writing') => {
  if (type === 'interview') {
    return {
      practical_skills: '실기',
      major_knowledge: '전공지식',
      major_suitability: '전공 적합성',
      attitude: '태도'
    }
  } else {
    return {
      practical_skills: '캐릭터',
      major_knowledge: '구성',
      major_suitability: '소재활용',
      attitude: '창의성'
    }
  }
}

export default function FeedbackPageClient({ sessionData: initialSessionData, currentUser, isHallOfFameMode = false }: FeedbackPageProps) {
  const [sessionData, setSessionData] = useState(initialSessionData)
  const [scores, setScores] = useState(initialSessionData.scores || {
    practical_skills: '',
    major_knowledge: '',
    major_suitability: '',
    attitude: ''
  })
  
  const [feedbackContent, setFeedbackContent] = useState('')
  const [reflectionText, setReflectionText] = useState('')
  const [newChecklistItem, setNewChecklistItem] = useState('')
  const [currentTime, setCurrentTime] = useState(new Date(new Date().toLocaleString('en-US', { timeZone: 'Asia/Seoul' })))
  const [evaluationType, setEvaluationType] = useState<'interview' | 'writing'>(
    initialSessionData.scores?.evaluation_type === '작법' ? 'writing' : 'interview'
  )

  // 실시간 시간 업데이트
  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentTime(new Date(new Date().toLocaleString('en-US', { timeZone: 'Asia/Seoul' })))
    }, 1000)
    
    return () => clearInterval(timer)
  }, [])

  const isTeacher = currentUser.role === 'teacher'
  const isStudent = currentUser.role === 'student'
  const isAdmin = currentUser.role === 'admin'

  // 편집 권한 확인 (명예의 전당 모드에서는 읽기 전용)
  const canEditScores = !isHallOfFameMode && isTeacher
  const canEditFeedback = !isHallOfFameMode && isTeacher
  const canEditChecklist = !isHallOfFameMode && (isTeacher || isStudent)
  const canEditReflection = !isHallOfFameMode && isStudent

  // 사용자 역할에 따른 대시보드 경로
  const getDashboardPath = () => {
    if (isHallOfFameMode) return '/hall-of-fame'
    if (isStudent) return '/dashboard/student/history'
    if (isTeacher) return '/dashboard/teacher'
    if (isAdmin) return '/dashboard/admin'
    return '/dashboard/student/history' // fallback
  }

  // 실시간 시간 상태 계산
  const getCurrentTimeStatus = () => {
    const scheduledStart = new Date(sessionData.scheduling.scheduledStartAt)
    const previewStart = new Date(scheduledStart.getTime() - sessionData.scheduling.previewLeadMinutes * 60000)
    const waitingRoomTime = new Date(scheduledStart.getTime() - 5 * 60000)
    const INTERVIEW_DURATION_MINUTES = 10
    const sessionEnd = new Date(scheduledStart.getTime() + INTERVIEW_DURATION_MINUTES * 60000)

    if (currentTime >= sessionEnd) {
      return { status: 'session_closed', canShow: true }
    } else if (currentTime < previewStart) {
      return { status: 'before_preview', canShow: false }
    } else if (currentTime >= previewStart && currentTime < waitingRoomTime) {
      return { status: 'preview_open', canShow: true }
    } else if (currentTime >= waitingRoomTime && currentTime < scheduledStart) {
      return { status: 'waiting_room', canShow: false }
    } else {
      return { status: 'interview_ready', canShow: true }
    }
  }

  const timeStatus = getCurrentTimeStatus()

  // 시간별 메시지 렌더링
  const renderTimeBasedMessage = () => {
    const scheduledStart = new Date(sessionData.scheduling.scheduledStartAt)
    const previewStart = new Date(scheduledStart.getTime() - sessionData.scheduling.previewLeadMinutes * 60000)
    const INTERVIEW_DURATION_MINUTES = 10
    const sessionEnd = new Date(scheduledStart.getTime() + INTERVIEW_DURATION_MINUTES * 60000)
    
    if (timeStatus.status === 'session_closed') {
      return (
        <div className="bg-gray-50 border border-gray-200 rounded-lg p-6 text-center">
          <div className="text-gray-800 text-lg font-medium mb-2">
            세션이 종료되었습니다
          </div>
          <div className="text-gray-600">
            면접이 완료되어 피드백을 확인할 수 있습니다.
          </div>
          <div className="text-sm text-gray-500 mt-2">
            종료 시간: {sessionEnd.toLocaleTimeString('ko-KR', { 
              hour: '2-digit', 
              minute: '2-digit',
              hour12: false 
            })}
          </div>
        </div>
      )
    } else if (timeStatus.status === 'before_preview') {
      return (
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-6 text-center">
          <div className="text-blue-800 text-lg font-medium mb-2">
            문제 공개 대기 중
          </div>
          <div className="text-blue-600">
            {previewStart.toLocaleTimeString('ko-KR', { 
              hour: '2-digit', 
              minute: '2-digit',
              hour12: false 
            })}에 문제가 오픈됩니다.
          </div>
          <div className="text-sm text-blue-500 mt-2">
            면접 예정 시간: {scheduledStart.toLocaleTimeString('ko-KR', { 
              hour: '2-digit', 
              minute: '2-digit',
              hour12: false 
            })}
          </div>
        </div>
      )
    } else if (timeStatus.status === 'waiting_room') {
      return (
        <div className="bg-orange-50 border border-orange-200 rounded-lg p-6 text-center">
          <div className="text-orange-800 text-lg font-medium mb-2">
            면접 5분 전입니다
          </div>
          <div className="text-orange-600">
            면접실 앞에서 대기하세요.
          </div>
          <div className="text-sm text-orange-500 mt-2">
            면접 시간: {scheduledStart.toLocaleTimeString('ko-KR', { 
              hour: '2-digit', 
              minute: '2-digit',
              hour12: false 
            })}
          </div>
        </div>
      )
    }
    return null
  }

  // 점수 제출 함수
  const handleScoreSubmit = async () => {
    try {
      const response = await fetch(`/api/sessions/${sessionData.sessionId}/scores`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(scores)
      })

      if (response.ok) {
        toast.success('점수가 저장되었습니다.')
        window.location.reload()
      } else {
        toast.error('점수 저장에 실패했습니다.')
      }
    } catch (error) {
      toast.error('오류가 발생했습니다.')
    }
  }

  // 피드백 제출 함수
  const handleFeedbackSubmit = async () => {
    if (!feedbackContent.trim()) {
      toast.error('피드백 내용을 입력해주세요.')
      return
    }

    try {
      const response = await fetch(`/api/sessions/${sessionData.sessionId}/feedback`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content: feedbackContent })
      })

      if (response.ok) {
        toast.success('피드백이 저장되었습니다.')
        setFeedbackContent('')
        window.location.reload()
      } else {
        toast.error('피드백 저장에 실패했습니다.')
      }
    } catch (error) {
      toast.error('오류가 발생했습니다.')
    }
  }

  // 통합 평가 제출 함수
  const handleEvaluationSubmit = async () => {
    // 유효성 검사
    const allScoresSelected = Object.values(scores).every(score => score.trim())
    if (!allScoresSelected) {
      toast.error('모든 점수를 선택해주세요.')
      return
    }

    if (!feedbackContent.trim()) {
      toast.error('피드백 내용을 입력해주세요.')
      return
    }

    try {
      // 점수 저장
      const scoreResponse = await fetch(`/api/sessions/${sessionData.sessionId}/scores`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...scores,
          evaluation_type: evaluationType === 'interview' ? '면접' : '작법'
        })
      })

      if (!scoreResponse.ok) {
        toast.error('점수 저장에 실패했습니다.')
        return
      }

      // 피드백 저장
      const feedbackResponse = await fetch(`/api/sessions/${sessionData.sessionId}/feedback`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content: feedbackContent })
      })

      if (!feedbackResponse.ok) {
        toast.error('피드백 저장에 실패했습니다.')
        return
      }

      toast.success('평가가 완료되었습니다.')
      setFeedbackContent('')
      window.location.reload()
    } catch (error) {
      toast.error('오류가 발생했습니다.')
    }
  }

  // 복기 제출 함수
  const handleReflectionSubmit = async () => {
    try {
      const response = await fetch(`/api/sessions/${sessionData.sessionId}/reflection`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reflectionText: reflectionText })
      })

      if (response.ok) {
        toast.success('복기가 저장되었습니다.')
        
        // sessionData 상태 업데이트
        setSessionData(prev => ({
          ...prev,
          studentReflection: {
            text: reflectionText,
            updated_at: new Date().toISOString()
          }
        }))
        
        // 텍스트박스 초기화
        setReflectionText('')
      } else {
        toast.error('복기 저장에 실패했습니다.')
      }
    } catch (error) {
      toast.error('오류가 발생했습니다.')
    }
  }

  // 체크리스트 항목 추가
  const handleAddChecklistItem = async () => {
    if (!newChecklistItem.trim()) {
      toast.error('체크리스트 항목을 입력해주세요.')
      return
    }

    try {
      const response = await fetch(`/api/sessions/${sessionData.sessionId}/checklist`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ item_text: newChecklistItem })
      })

      if (response.ok) {
        toast.success('체크리스트 항목이 추가되었습니다.')
        setNewChecklistItem('')
        window.location.reload()
      } else {
        toast.error('체크리스트 추가에 실패했습니다.')
      }
    } catch (error) {
      toast.error('오류가 발생했습니다.')
    }
  }

  // 체크리스트 체크/언체크
  const handleChecklistToggle = async (itemId: number, isChecked: boolean) => {
    try {
      const response = await fetch(`/api/sessions/${sessionData.sessionId}/checklist/${itemId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ is_checked: !isChecked })
      })

      if (response.ok) {
        toast.success('체크리스트가 업데이트되었습니다.')
        window.location.reload()
      } else {
        toast.error('체크리스트 업데이트에 실패했습니다.')
      }
    } catch (error) {
      toast.error('오류가 발생했습니다.')
    }
  }

  return (
    <div className="min-h-screen bg-gray-100">
      <div className="max-w-6xl mx-auto px-4 py-8">
        {/* 헤더 */}
        <div className="bg-white rounded-lg shadow-md p-6 mb-6">
          <div className="flex justify-between items-start">
            <div>
              <h1 className="text-2xl font-bold text-gray-800 flex items-center">
                {isHallOfFameMode && (
                  <div className="w-8 h-8 bg-yellow-100 rounded-lg flex items-center justify-center mr-3">
                    <svg className="w-5 h-5 text-yellow-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 3v4M3 5h4M6 17v4m-2-2h4m5-16l2.286 6.857L21 12l-5.714 2.143L13 21l-2.286-6.857L5 12l5.714-2.143L13 3z" />
                    </svg>
                  </div>
                )}
                학습 피드백 {isHallOfFameMode && '🏆'}
              </h1>
              <p className="text-gray-600">
                {formatDate(sessionData.slot.date)} {getSessionPeriodTime(sessionData.slot.session_period)}
                {timeStatus.canShow && sessionData.problemSnapshot && ` | ${sessionData.student.name} 학생 | ${sessionData.teacher.name} 선생님`}
                {isHallOfFameMode && (
                  <span className="ml-3 px-2 py-1 bg-yellow-100 text-yellow-800 text-xs rounded-full">
                    명예의 전당
                  </span>
                )}
              </p>
            </div>
            <Link 
              href={getDashboardPath()}
              className="px-4 py-2 bg-gray-500 text-white rounded-lg hover:bg-gray-600 transition-colors"
            >
              {isHallOfFameMode ? '명예의 전당으로' : '목록으로'}
            </Link>
          </div>
        </div>

        {/* 문제 정보 - 시간 상태별 조건부 렌더링 */}
        <div className="bg-white rounded-lg shadow-md p-8 mb-6">
          <h2 className="text-xl font-bold text-gray-800 mb-6">문제 정보</h2>
          
          {/* 시간 기반 메시지 또는 문제 내용 표시 */}
          {!timeStatus.canShow && !isTeacher && !isAdmin ? (
            renderTimeBasedMessage()
          ) : sessionData.problemSnapshot ? (
            <div className="space-y-4">
              <div>
                <h3 className="font-medium text-gray-700 text-lg mb-2">문제 제목</h3>
                <p className="text-gray-900 text-lg">{sessionData.problemSnapshot.title}</p>
              </div>
              <div className="flex space-x-6">
                <div>
                  <h3 className="font-medium text-gray-700 mb-1">사전 열람시간</h3>
                  <span className="px-3 py-1 bg-blue-100 text-blue-700 text-sm rounded">
                    {sessionData.scheduling.previewLeadMinutes}분
                  </span>
                </div>
                <div>
                  <h3 className="font-medium text-gray-700 mb-1">공개일</h3>
                  <span className="px-3 py-1 bg-green-100 text-green-700 text-sm rounded">
                    {sessionData.problemSnapshot.available_date}
                  </span>
                </div>
              </div>
              <div>
                <h3 className="font-medium text-gray-700 text-lg mb-3">문제 내용</h3>
                <div className="bg-gray-50 p-6 rounded-lg mt-2">
                  {/* 텍스트 내용 */}
                  <div className="prose prose-lg max-w-none text-gray-800 leading-relaxed mb-4">
                    <pre className="whitespace-pre-wrap text-base text-gray-800 leading-relaxed break-words">
                      {sessionData.problemSnapshot.content}
                    </pre>
                  </div>
                  
                  {/* 이미지들 */}
                  {sessionData.problemSnapshot.images && sessionData.problemSnapshot.images.length > 0 && (
                    <div className="mt-6 space-y-4">
                      <h4 className="font-medium text-gray-700">첨부 이미지</h4>
                      <div className="grid gap-4">
                        {sessionData.problemSnapshot.images.map((image: any, index: number) => (
                          <div key={index} className="flex flex-col items-center">
                            <img
                              src={image.url || image.src || image}
                              alt={image.alt || `문제 이미지 ${index + 1}`}
                              className="max-w-full h-auto rounded-lg shadow-md hover:shadow-lg transition-shadow cursor-pointer"
                              onClick={() => window.open(image.url || image.src || image, '_blank')}
                              style={{ maxHeight: '600px', objectFit: 'contain' }}
                            />
                            {image.caption && (
                              <p className="text-sm text-gray-600 mt-2 text-center">
                                {image.caption}
                              </p>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>
          ) : (
            <p className="text-gray-500">문제 정보가 없습니다.</p>
          )}
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

          {/* 점수 및 평가 */}
          <div className="bg-white rounded-lg shadow-md p-6">
            <h2 className="text-xl font-bold text-gray-800 mb-4">점수 및 평가</h2>
            {sessionData.scores ? (
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="text-center">
                    <p className="text-sm text-gray-600">{getEvaluationLabels(evaluationType).practical_skills}</p>
                    <p className={`text-lg font-semibold ${getScoreColor(sessionData.scores.practical_skills)}`}>
                      {sessionData.scores.practical_skills}
                    </p>
                  </div>
                  <div className="text-center">
                    <p className="text-sm text-gray-600">{getEvaluationLabels(evaluationType).major_knowledge}</p>
                    <p className={`text-lg font-semibold ${getScoreColor(sessionData.scores.major_knowledge)}`}>
                      {sessionData.scores.major_knowledge}
                    </p>
                  </div>
                  <div className="text-center">
                    <p className="text-sm text-gray-600">{getEvaluationLabels(evaluationType).major_suitability}</p>
                    <p className={`text-lg font-semibold ${getScoreColor(sessionData.scores.major_suitability)}`}>
                      {sessionData.scores.major_suitability}
                    </p>
                  </div>
                  <div className="text-center">
                    <p className="text-sm text-gray-600">{getEvaluationLabels(evaluationType).attitude}</p>
                    <p className={`text-lg font-semibold ${getScoreColor(sessionData.scores.attitude)}`}>
                      {sessionData.scores.attitude}
                    </p>
                  </div>
                </div>
              </div>
            ) : canEditScores ? (
              <div className="space-y-4">
                {/* 평가 유형 토글 */}
                <div className="flex items-center justify-between mb-4">
                  <p className="text-gray-500">평가 유형을 선택하고 점수를 입력해주세요.</p>
                  <div className="flex items-center space-x-2">
                    <span className={`text-sm ${evaluationType === 'interview' ? 'text-blue-600 font-medium' : 'text-gray-500'}`}>
                      면접
                    </span>
                    <button
                      onClick={() => setEvaluationType(evaluationType === 'interview' ? 'writing' : 'interview')}
                      className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 ${
                        evaluationType === 'writing' ? 'bg-blue-600' : 'bg-gray-300'
                      }`}
                    >
                      <span
                        className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                          evaluationType === 'writing' ? 'translate-x-6' : 'translate-x-1'
                        }`}
                      />
                    </button>
                    <span className={`text-sm ${evaluationType === 'writing' ? 'text-blue-600 font-medium' : 'text-gray-500'}`}>
                      작법
                    </span>
                  </div>
                </div>
                
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      {getEvaluationLabels(evaluationType).practical_skills}
                    </label>
                    <select
                      value={scores.practical_skills}
                      onChange={(e) => setScores({...scores, practical_skills: e.target.value})}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md"
                    >
                      <option value="">선택</option>
                      <option value="상">상</option>
                      <option value="중상">중상</option>
                      <option value="중">중</option>
                      <option value="중하">중하</option>
                      <option value="하">하</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      {getEvaluationLabels(evaluationType).major_knowledge}
                    </label>
                    <select
                      value={scores.major_knowledge}
                      onChange={(e) => setScores({...scores, major_knowledge: e.target.value})}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md"
                    >
                      <option value="">선택</option>
                      <option value="상">상</option>
                      <option value="중상">중상</option>
                      <option value="중">중</option>
                      <option value="중하">중하</option>
                      <option value="하">하</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      {getEvaluationLabels(evaluationType).major_suitability}
                    </label>
                    <select
                      value={scores.major_suitability}
                      onChange={(e) => setScores({...scores, major_suitability: e.target.value})}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md"
                    >
                      <option value="">선택</option>
                      <option value="상">상</option>
                      <option value="중상">중상</option>
                      <option value="중">중</option>
                      <option value="중하">중하</option>
                      <option value="하">하</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      {getEvaluationLabels(evaluationType).attitude}
                    </label>
                    <select
                      value={scores.attitude}
                      onChange={(e) => setScores({...scores, attitude: e.target.value})}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md"
                    >
                      <option value="">선택</option>
                      <option value="상">상</option>
                      <option value="중상">중상</option>
                      <option value="중">중</option>
                      <option value="중하">중하</option>
                      <option value="하">하</option>
                    </select>
                  </div>
                </div>
              </div>
            ) : (
              <p className="text-gray-500">아직 점수가 등록되지 않았습니다.</p>
            )}
          </div>

          {/* 교사 피드백 */}
          <div className="bg-white rounded-lg shadow-md p-6">
            <h2 className="text-xl font-bold text-gray-800 mb-4">교사 피드백</h2>
            {sessionData.teacherFeedback.length === 0 ? (
              <div>
                <p className="text-gray-500 mb-4">아직 피드백이 등록되지 않았습니다.</p>
                {canEditFeedback && (
                  <div className="space-y-4">
                    <textarea
                      value={feedbackContent}
                      onChange={(e) => setFeedbackContent(e.target.value)}
                      placeholder="피드백 내용을 입력해주세요..."
                      className="w-full px-3 py-2 border border-gray-300 rounded-md h-32 resize-none"
                    />
                    {canEditFeedback && sessionData.scores && (
                      <button
                        onClick={handleFeedbackSubmit}
                        className="px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700"
                      >
                        피드백 저장
                      </button>
                    )}
                  </div>
                )}
              </div>
            ) : (
              <div className="space-y-4">
                {sessionData.teacherFeedback.map((feedback) => (
                  <div key={feedback.id} className="bg-gray-50 p-4 rounded-lg">
                    <div className="flex justify-between items-start mb-2">
                      <span className="px-2 py-1 bg-blue-100 text-blue-700 text-xs rounded">
                        {feedback.feedback_type}
                      </span>
                      <span className="text-xs text-gray-500">
                        {formatKoreanDate(feedback.created_at)}
                      </span>
                    </div>
                    <p className="text-gray-800 whitespace-pre-wrap">
                      {feedback.content}
                    </p>
                  </div>
                ))}
                {canEditFeedback && sessionData.scores && (
                  <div className="space-y-4 border-t pt-4">
                    <textarea
                      value={feedbackContent}
                      onChange={(e) => setFeedbackContent(e.target.value)}
                      placeholder="추가 피드백을 입력해주세요..."
                      className="w-full px-3 py-2 border border-gray-300 rounded-md h-32 resize-none"
                    />
                    <button
                      onClick={handleFeedbackSubmit}
                      className="px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700"
                    >
                      피드백 추가
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* 통합 평가 완료 버튼 */}
          {canEditScores && canEditFeedback && !sessionData.scores && (
            <div className="bg-white rounded-lg shadow-md p-6 lg:col-span-2">
              <button
                onClick={handleEvaluationSubmit}
                className="w-full px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-lg font-medium"
              >
                평가 완료 (점수 + 피드백 저장)
              </button>
            </div>
          )}

          {/* 학습 체크리스트 */}
          <div className="bg-white rounded-lg shadow-md p-6">
            <h2 className="text-xl font-bold text-gray-800 mb-4">학습 체크리스트</h2>
            {sessionData.checklistItems.length === 0 ? (
              <div>
                <p className="text-gray-500 mb-4">체크리스트 항목이 없습니다.</p>
                {canEditChecklist && isTeacher && (
                  <div className="space-y-4">
                    <input
                      type="text"
                      value={newChecklistItem}
                      onChange={(e) => setNewChecklistItem(e.target.value)}
                      placeholder="체크리스트 항목을 입력해주세요..."
                      className="w-full px-3 py-2 border border-gray-300 rounded-md"
                    />
                    <button
                      onClick={handleAddChecklistItem}
                      className="px-4 py-2 bg-purple-600 text-white rounded-md hover:bg-purple-700"
                    >
                      항목 추가
                    </button>
                  </div>
                )}
              </div>
            ) : (
              <div className="space-y-3">
                {sessionData.checklistItems.map((item) => (
                  <div key={item.id} className="flex items-center space-x-3">
                    <div className={`w-5 h-5 rounded border-2 flex items-center justify-center ${
                      item.is_checked ? 'bg-green-500 border-green-500' : 'border-gray-300'
                    }`}>
                      {item.is_checked && (
                        <svg className="w-3 h-3 text-white" fill="currentColor" viewBox="0 0 20 20">
                          <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                        </svg>
                      )}
                    </div>
                    <button
                      onClick={() => canEditChecklist && isStudent && handleChecklistToggle(item.id, item.is_checked)}
                      className={`flex-1 text-left ${item.is_checked ? 'text-gray-500 line-through' : 'text-gray-900'} ${
                        canEditChecklist && isStudent ? 'hover:bg-gray-50 p-2 rounded' : ''
                      }`}
                      disabled={!canEditChecklist || !isStudent}
                    >
                      {item.item_text}
                    </button>
                  </div>
                ))}
                {canEditChecklist && isTeacher && (
                  <div className="space-y-4 border-t pt-4">
                    <input
                      type="text"
                      value={newChecklistItem}
                      onChange={(e) => setNewChecklistItem(e.target.value)}
                      placeholder="추가 체크리스트 항목..."
                      className="w-full px-3 py-2 border border-gray-300 rounded-md"
                    />
                    <button
                      onClick={handleAddChecklistItem}
                      className="px-4 py-2 bg-purple-600 text-white rounded-md hover:bg-purple-700"
                    >
                      항목 추가
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* 학생 복기 */}
          <div className="bg-white rounded-lg shadow-md p-6 lg:col-span-2">
            <h2 className="text-xl font-bold text-gray-800 mb-4">학생 복기</h2>
            {canEditReflection ? (
              sessionData.studentReflection?.text ? (
                <div className="space-y-4">
                  {/* 저장된 복기 표시 */}
                  <div className="bg-gray-50 p-4 rounded-lg">
                    <p className="text-gray-800 whitespace-pre-wrap">
                      {sessionData.studentReflection.text}
                    </p>
                    <p className="text-xs text-gray-500 mt-2">
                      작성일: {formatKoreanDate(sessionData.studentReflection.updated_at)}
                    </p>
                  </div>
                  
                  {/* 수정용 텍스트박스 */}
                  <div className="space-y-2">
                    <textarea
                      value={reflectionText}
                      onChange={(e) => setReflectionText(e.target.value)}
                      placeholder="복기를 수정하려면 여기에 새로운 내용을 작성해주세요..."
                      className="w-full px-3 py-2 border border-gray-300 rounded-md h-32 resize-none"
                    />
                    <button
                      onClick={handleReflectionSubmit}
                      className="px-4 py-2 bg-orange-600 text-white rounded-md hover:bg-orange-700"
                      disabled={!reflectionText.trim()}
                    >
                      복기 수정
                    </button>
                  </div>
                </div>
              ) : (
                <div className="space-y-4">
                  <textarea
                    value={reflectionText}
                    onChange={(e) => setReflectionText(e.target.value)}
                    placeholder="오늘 학습에 대한 복기를 작성해주세요..."
                    className="w-full px-3 py-2 border border-gray-300 rounded-md h-32 resize-none"
                  />
                  <button
                    onClick={handleReflectionSubmit}
                    className="px-4 py-2 bg-orange-600 text-white rounded-md hover:bg-orange-700"
                    disabled={!reflectionText.trim()}
                  >
                    복기 저장
                  </button>
                </div>
              )
            ) : sessionData.studentReflection?.text ? (
              <div className="bg-gray-50 p-4 rounded-lg">
                <p className="text-gray-800 whitespace-pre-wrap">
                  {sessionData.studentReflection.text}
                </p>
                <p className="text-xs text-gray-500 mt-2">
                  작성일: {formatKoreanDate(sessionData.studentReflection.updated_at)}
                </p>
              </div>
            ) : (
              <p className="text-gray-500">아직 학생 복기가 작성되지 않았습니다.</p>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}