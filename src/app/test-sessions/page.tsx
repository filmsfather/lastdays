'use client'

import { useState, useEffect } from 'react'
import { getCurrentUser } from '@/lib/auth'

interface User {
  id: number
  name: string
  className: string
  role: 'student' | 'teacher' | 'admin'
}

interface Session {
  sessionId: number
  status: string
  startedAt: string
  completedAt?: string
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
    block: number
  }
  problemSnapshot: any
  scores: any
  teacherFeedback: any[]
  checklistItems: any[]
  studentReflection: any
  canShowProblem: boolean
}

export default function TestSessionsPage() {
  const [user, setUser] = useState<User | null>(null)
  const [sessionId, setSessionId] = useState<string>('')
  const [sessionData, setSessionData] = useState<Session | null>(null)
  const [loading, setLoading] = useState<boolean>(false)
  const [error, setError] = useState<string>('')

  // 채점 폼 상태
  const [gradeForm, setGradeForm] = useState({
    problemUnderstanding: 1,
    solutionApproach: 1,
    calculationAccuracy: 1,
    presentationClarity: 1
  })

  // 피드백 폼 상태
  const [feedbackForm, setFeedbackForm] = useState({
    content: '',
    feedbackType: 'general'
  })

  // 체크리스트 폼 상태
  const [checklistForm, setChecklistForm] = useState({
    itemText: ''
  })

  // 복기 폼 상태
  const [reflectionForm, setReflectionForm] = useState({
    reflectionText: '',
    selfAssessment: 1,
    areasForImprovement: ''
  })

  useEffect(() => {
    const loadUser = async () => {
      try {
        const response = await fetch('/api/auth/me')
        if (response.ok) {
          const data = await response.json()
          setUser(data.user)
        }
      } catch (error) {
        console.error('Failed to load user:', error)
      }
    }
    loadUser()
  }, [])

  // 세션 데이터 조회
  const loadSessionData = async () => {
    if (!sessionId) return
    
    setLoading(true)
    setError('')
    
    try {
      const response = await fetch(`/api/sessions/${sessionId}/feedback-page`)
      const data = await response.json()
      
      if (data.success) {
        setSessionData(data.data)
      } else {
        setError(data.error || '세션 데이터 조회에 실패했습니다.')
      }
    } catch (error) {
      setError('서버 오류가 발생했습니다.')
    } finally {
      setLoading(false)
    }
  }

  // 채점 제출
  const submitGrade = async () => {
    if (!sessionId) return
    
    try {
      const response = await fetch(`/api/teacher/sessions/${sessionId}/grade`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(gradeForm)
      })
      
      const data = await response.json()
      if (data.success) {
        alert('채점이 저장되었습니다.')
        loadSessionData() // 데이터 새로고침
      } else {
        alert(data.error || '채점 저장에 실패했습니다.')
      }
    } catch (error) {
      alert('서버 오류가 발생했습니다.')
    }
  }

  // 피드백 제출
  const submitFeedback = async () => {
    if (!sessionId || !feedbackForm.content.trim()) return
    
    try {
      const response = await fetch(`/api/teacher/sessions/${sessionId}/feedback`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(feedbackForm)
      })
      
      const data = await response.json()
      if (data.success) {
        alert('피드백이 저장되었습니다.')
        setFeedbackForm({ content: '', feedbackType: 'general' })
        loadSessionData()
      } else {
        alert(data.error || '피드백 저장에 실패했습니다.')
      }
    } catch (error) {
      alert('서버 오류가 발생했습니다.')
    }
  }

  // 체크리스트 항목 추가
  const addChecklistItem = async () => {
    if (!sessionId || !checklistForm.itemText.trim()) return
    
    try {
      const response = await fetch(`/api/teacher/sessions/${sessionId}/checklist`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(checklistForm)
      })
      
      const data = await response.json()
      if (data.success) {
        alert('체크리스트 항목이 추가되었습니다.')
        setChecklistForm({ itemText: '' })
        loadSessionData()
      } else {
        alert(data.error || '체크리스트 추가에 실패했습니다.')
      }
    } catch (error) {
      alert('서버 오류가 발생했습니다.')
    }
  }

  // 체크리스트 항목 토글
  const toggleChecklistItem = async (itemId: number) => {
    if (!sessionId) return
    
    try {
      const response = await fetch(`/api/sessions/${sessionId}/checklist/${itemId}/toggle`, {
        method: 'POST'
      })
      
      const data = await response.json()
      if (data.success) {
        alert(data.message)
        loadSessionData()
      } else {
        alert(data.error || '체크리스트 토글에 실패했습니다.')
      }
    } catch (error) {
      alert('서버 오류가 발생했습니다.')
    }
  }

  // 복기 제출
  const submitReflection = async () => {
    if (!sessionId || !reflectionForm.reflectionText.trim()) return
    
    try {
      const response = await fetch(`/api/sessions/${sessionId}/reflection`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(reflectionForm)
      })
      
      const data = await response.json()
      if (data.success) {
        alert('복기가 저장되었습니다.')
        loadSessionData()
      } else {
        alert(data.error || '복기 저장에 실패했습니다.')
      }
    } catch (error) {
      alert('서버 오류가 발생했습니다.')
    }
  }

  if (!user) {
    return <div className="p-4">로그인이 필요합니다.</div>
  }

  return (
    <div className="max-w-6xl mx-auto p-4">
      <h1 className="text-2xl font-bold mb-6">Task 6, 7 API 테스트 페이지</h1>
      
      <div className="mb-6 p-4 bg-gray-50 rounded">
        <p><strong>현재 사용자:</strong> {user.name} ({user.className}) - {user.role}</p>
      </div>

      {/* 세션 ID 입력 */}
      <div className="mb-6 p-4 border rounded">
        <h2 className="text-lg font-semibold mb-3">세션 조회</h2>
        <div className="flex gap-2">
          <input
            type="number"
            placeholder="세션 ID 입력"
            value={sessionId}
            onChange={(e) => setSessionId(e.target.value)}
            className="border px-3 py-2 rounded flex-1"
          />
          <button
            onClick={loadSessionData}
            disabled={loading}
            className="bg-blue-500 text-white px-4 py-2 rounded hover:bg-blue-600 disabled:opacity-50"
          >
            {loading ? '조회 중...' : '조회'}
          </button>
        </div>
        {error && <p className="text-red-500 mt-2">{error}</p>}
      </div>

      {/* 세션 데이터 표시 */}
      {sessionData && (
        <div className="space-y-6">
          {/* 세션 기본 정보 */}
          <div className="p-4 border rounded">
            <h2 className="text-lg font-semibold mb-3">세션 정보</h2>
            <div className="grid grid-cols-2 gap-4">
              <div><strong>세션 ID:</strong> {sessionData.sessionId}</div>
              <div><strong>상태:</strong> {sessionData.status}</div>
              <div><strong>학생:</strong> {sessionData.student.name} ({sessionData.student.className})</div>
              <div><strong>교사:</strong> {sessionData.teacher.name} ({sessionData.teacher.className})</div>
              <div><strong>날짜:</strong> {sessionData.slot.date}</div>
              <div><strong>블록:</strong> {sessionData.slot.block}</div>
            </div>
          </div>

          {/* 문제 정보 */}
          {sessionData.problemSnapshot && (
            <div className="p-4 border rounded">
              <h2 className="text-lg font-semibold mb-3">문제 정보</h2>
              <div><strong>제목:</strong> {sessionData.problemSnapshot.title}</div>
              <div><strong>난이도:</strong> {sessionData.problemSnapshot.difficulty_level}</div>
              <div><strong>영역:</strong> {sessionData.problemSnapshot.subject_area}</div>
              <div className="mt-2">
                <strong>내용:</strong>
                <div className="mt-1 p-2 bg-gray-50 rounded whitespace-pre-wrap">
                  {sessionData.problemSnapshot.content}
                </div>
              </div>
            </div>
          )}

          {/* 채점 정보 */}
          <div className="p-4 border rounded">
            <h2 className="text-lg font-semibold mb-3">채점 정보</h2>
            {sessionData.scores ? (
              <div className="grid grid-cols-2 gap-4">
                <div><strong>문제 이해:</strong> {sessionData.scores.problem_understanding}/5</div>
                <div><strong>해결 접근:</strong> {sessionData.scores.solution_approach}/5</div>
                <div><strong>계산 정확성:</strong> {sessionData.scores.calculation_accuracy}/5</div>
                <div><strong>발표 명확성:</strong> {sessionData.scores.presentation_clarity}/5</div>
                <div><strong>총점:</strong> {sessionData.scores.total_score}/20</div>
              </div>
            ) : (
              <p className="text-gray-500">아직 채점되지 않았습니다.</p>
            )}
          </div>

          {/* 교사용 채점 폼 */}
          {user.role === 'teacher' && (
            <div className="p-4 border rounded bg-blue-50">
              <h2 className="text-lg font-semibold mb-3">채점하기</h2>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium mb-1">문제 이해 (1-5)</label>
                  <input
                    type="number"
                    min="1"
                    max="5"
                    value={gradeForm.problemUnderstanding}
                    onChange={(e) => setGradeForm({...gradeForm, problemUnderstanding: parseInt(e.target.value)})}
                    className="border px-3 py-2 rounded w-full"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">해결 접근 (1-5)</label>
                  <input
                    type="number"
                    min="1"
                    max="5"
                    value={gradeForm.solutionApproach}
                    onChange={(e) => setGradeForm({...gradeForm, solutionApproach: parseInt(e.target.value)})}
                    className="border px-3 py-2 rounded w-full"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">계산 정확성 (1-5)</label>
                  <input
                    type="number"
                    min="1"
                    max="5"
                    value={gradeForm.calculationAccuracy}
                    onChange={(e) => setGradeForm({...gradeForm, calculationAccuracy: parseInt(e.target.value)})}
                    className="border px-3 py-2 rounded w-full"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">발표 명확성 (1-5)</label>
                  <input
                    type="number"
                    min="1"
                    max="5"
                    value={gradeForm.presentationClarity}
                    onChange={(e) => setGradeForm({...gradeForm, presentationClarity: parseInt(e.target.value)})}
                    className="border px-3 py-2 rounded w-full"
                  />
                </div>
              </div>
              <button
                onClick={submitGrade}
                className="mt-4 bg-blue-500 text-white px-4 py-2 rounded hover:bg-blue-600"
              >
                채점 저장
              </button>
            </div>
          )}

          {/* 피드백 */}
          <div className="p-4 border rounded">
            <h2 className="text-lg font-semibold mb-3">교사 피드백</h2>
            {sessionData.teacherFeedback.length > 0 ? (
              <div className="space-y-2">
                {sessionData.teacherFeedback.map((feedback: any) => (
                  <div key={feedback.id} className="p-3 bg-gray-50 rounded">
                    <div className="text-sm text-gray-600">
                      {feedback.giver.name} - {new Date(feedback.created_at).toLocaleString()}
                    </div>
                    <div className="mt-1">{feedback.content}</div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-gray-500">아직 피드백이 없습니다.</p>
            )}
          </div>

          {/* 교사용 피드백 폼 */}
          {user.role === 'teacher' && (
            <div className="p-4 border rounded bg-blue-50">
              <h2 className="text-lg font-semibold mb-3">피드백 작성</h2>
              <textarea
                placeholder="피드백 내용을 입력하세요"
                value={feedbackForm.content}
                onChange={(e) => setFeedbackForm({...feedbackForm, content: e.target.value})}
                className="border px-3 py-2 rounded w-full h-32 resize-none"
              />
              <div className="mt-2">
                <select
                  value={feedbackForm.feedbackType}
                  onChange={(e) => setFeedbackForm({...feedbackForm, feedbackType: e.target.value})}
                  className="border px-3 py-2 rounded"
                >
                  <option value="general">일반</option>
                  <option value="strength">강점</option>
                  <option value="improvement">개선점</option>
                </select>
                <button
                  onClick={submitFeedback}
                  className="ml-2 bg-blue-500 text-white px-4 py-2 rounded hover:bg-blue-600"
                >
                  피드백 저장
                </button>
              </div>
            </div>
          )}

          {/* 체크리스트 */}
          <div className="p-4 border rounded">
            <h2 className="text-lg font-semibold mb-3">체크리스트</h2>
            {sessionData.checklistItems.length > 0 ? (
              <div className="space-y-2">
                {sessionData.checklistItems.map((item: any) => (
                  <div key={item.id} className="flex items-center gap-2 p-2 bg-gray-50 rounded">
                    <input
                      type="checkbox"
                      checked={item.is_checked}
                      onChange={() => toggleChecklistItem(item.id)}
                      disabled={user.role !== 'student'}
                      className="w-4 h-4"
                    />
                    <span className={item.is_checked ? 'line-through text-gray-500' : ''}>
                      {item.item_text}
                    </span>
                    {item.is_checked && item.checker && (
                      <span className="text-sm text-gray-600 ml-auto">
                        ({item.checker.name}이 완료)
                      </span>
                    )}
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-gray-500">체크리스트가 없습니다.</p>
            )}
          </div>

          {/* 교사용 체크리스트 항목 추가 */}
          {user.role === 'teacher' && (
            <div className="p-4 border rounded bg-blue-50">
              <h2 className="text-lg font-semibold mb-3">체크리스트 항목 추가</h2>
              <div className="flex gap-2">
                <input
                  type="text"
                  placeholder="체크리스트 항목 내용"
                  value={checklistForm.itemText}
                  onChange={(e) => setChecklistForm({itemText: e.target.value})}
                  className="border px-3 py-2 rounded flex-1"
                />
                <button
                  onClick={addChecklistItem}
                  className="bg-blue-500 text-white px-4 py-2 rounded hover:bg-blue-600"
                >
                  추가
                </button>
              </div>
            </div>
          )}

          {/* 학생 복기 */}
          <div className="p-4 border rounded">
            <h2 className="text-lg font-semibold mb-3">학생 복기</h2>
            {sessionData.studentReflection ? (
              <div className="space-y-2">
                <div>
                  <strong>복기 내용:</strong>
                  <div className="mt-1 p-2 bg-gray-50 rounded whitespace-pre-wrap">
                    {sessionData.studentReflection.reflection_text}
                  </div>
                </div>
                {sessionData.studentReflection.self_assessment && (
                  <div><strong>자기 평가:</strong> {sessionData.studentReflection.self_assessment}/5</div>
                )}
                {sessionData.studentReflection.areas_for_improvement && (
                  <div>
                    <strong>개선이 필요한 영역:</strong>
                    <div className="mt-1 p-2 bg-gray-50 rounded">
                      {sessionData.studentReflection.areas_for_improvement}
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <p className="text-gray-500">아직 복기가 작성되지 않았습니다.</p>
            )}
          </div>

          {/* 학생용 복기 작성 폼 */}
          {user.role === 'student' && (
            <div className="p-4 border rounded bg-green-50">
              <h2 className="text-lg font-semibold mb-3">복기 작성</h2>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium mb-1">복기 내용</label>
                  <textarea
                    placeholder="오늘 문제 풀이에 대한 복기를 작성해주세요"
                    value={reflectionForm.reflectionText}
                    onChange={(e) => setReflectionForm({...reflectionForm, reflectionText: e.target.value})}
                    className="border px-3 py-2 rounded w-full h-32 resize-none"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">자기 평가 (1-5)</label>
                  <input
                    type="number"
                    min="1"
                    max="5"
                    value={reflectionForm.selfAssessment}
                    onChange={(e) => setReflectionForm({...reflectionForm, selfAssessment: parseInt(e.target.value)})}
                    className="border px-3 py-2 rounded w-20"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">개선이 필요한 영역</label>
                  <textarea
                    placeholder="앞으로 개선하고 싶은 부분을 적어주세요"
                    value={reflectionForm.areasForImprovement}
                    onChange={(e) => setReflectionForm({...reflectionForm, areasForImprovement: e.target.value})}
                    className="border px-3 py-2 rounded w-full h-20 resize-none"
                  />
                </div>
                <button
                  onClick={submitReflection}
                  className="bg-green-500 text-white px-4 py-2 rounded hover:bg-green-600"
                >
                  복기 저장
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}