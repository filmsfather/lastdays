import { getCurrentUser } from '@/lib/auth'
import { supabase } from '@/lib/supabase'
import Link from 'next/link'
import { redirect } from 'next/navigation'

interface SessionFeedbackData {
  sessionId: number
  status: string
  startedAt: string
  completedAt: string
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
  problemSnapshot: {
    id: number
    title: string
    content: string
    difficulty_level: number
    subject_area: string
  } | null
  scores: {
    problem_understanding: number
    solution_approach: number
    calculation_accuracy: number
    presentation_clarity: number
    total_score: number
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
    reflection_text: string
    self_assessment: number
    areas_for_improvement: string
  } | null
}

// 블록 시간 변환 함수
const getBlockTime = (block: number) => {
  const times = [
    '', '09:00-09:40', '09:50-10:30', '10:40-11:20', '11:30-12:10', '12:20-13:00',
    '13:10-13:50', '14:00-14:40', '14:50-15:30', '15:40-16:20', '16:30-17:10'
  ]
  return times[block] || `${block}교시`
}

// 날짜 포맷팅 함수
const formatDate = (dateString: string) => {
  const date = new Date(dateString)
  return date.toLocaleDateString('ko-KR', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    weekday: 'short'
  })
}

// 점수 색상 가져오기 함수
const getScoreColor = (score: number) => {
  if (score >= 4) return 'text-green-600'
  if (score >= 3) return 'text-yellow-600'
  return 'text-red-600'
}

export default async function SessionFeedbackPage({
  params
}: {
  params: Promise<{ id: string }>
}) {
  const resolvedParams = await params
  const sessionId = parseInt(resolvedParams.id)

  if (isNaN(sessionId)) {
    redirect('/dashboard/student')
  }

  // 사용자 인증 확인
  const currentUser = await getCurrentUser()
  if (!currentUser) {
    redirect('/login')
  }

  // 피드백 데이터 조회 (직접 Supabase 쿼리)
  const { data: session, error: sessionError } = await supabase
    .from('sessions')
    .select(`
      *,
      reservation:reservation_id (
        id,
        student_id,
        slot:slot_id (
          id,
          date,
          block,
          teacher:teacher_id (
            id,
            name,
            class_name
          )
        ),
        student:student_id (
          id,
          name,
          class_name
        )
      ),
      problem:problem_id (
        id,
        title,
        content,
        difficulty_level,
        subject_area
      )
    `)
    .eq('id', sessionId)
    .single()

  if (sessionError || !session) {
    redirect('/dashboard/student/history')
  }

  // 권한 확인: 학생 본인, 담당 교사, 또는 관리자만 조회 가능
  const isStudent = currentUser.role === 'student' && session.reservation.student_id === currentUser.id
  const isTeacher = currentUser.role === 'teacher' && session.reservation.slot.teacher.id === currentUser.id
  const isAdmin = currentUser.role === 'admin'

  if (!isStudent && !isTeacher && !isAdmin) {
    redirect('/dashboard/student/history')
  }

  // 추가 데이터 조회
  const { data: scores } = await supabase
    .from('scores')
    .select(`
      *,
      scorer:scored_by (
        id,
        name,
        class_name
      )
    `)
    .eq('session_id', sessionId)
    .single()

  const { data: feedbacks } = await supabase
    .from('feedbacks')
    .select(`
      *,
      giver:given_by (
        id,
        name,
        class_name
      )
    `)
    .eq('session_id', sessionId)

  const { data: checklistItems } = await supabase
    .from('checklist_items')
    .select(`
      *,
      checker:checked_by (
        id,
        name,
        class_name
      )
    `)
    .eq('session_id', sessionId)
    .order('created_at', { ascending: true })

  const { data: studentReflection } = await supabase
    .from('student_reflections')
    .select('*')
    .eq('session_id', sessionId)
    .single()

  // 문제 표시 권한 확인
  const canShowProblem = session.status === 'completed'
  const problemSnapshot = canShowProblem ? {
    id: session.problem.id,
    title: session.problem.title,
    content: session.problem.content,
    difficulty_level: session.problem.difficulty_level,
    subject_area: session.problem.subject_area
  } : null

  // 피드백 데이터 구성
  const feedbackData: SessionFeedbackData = {
    sessionId: session.id,
    status: session.status,
    startedAt: session.started_at,
    completedAt: session.completed_at,
    student: {
      id: session.reservation.student.id,
      name: session.reservation.student.name,
      className: session.reservation.student.class_name
    },
    teacher: {
      id: session.reservation.slot.teacher.id,
      name: session.reservation.slot.teacher.name,
      className: session.reservation.slot.teacher.class_name
    },
    slot: {
      date: session.reservation.slot.date,
      block: session.reservation.slot.block
    },
    problemSnapshot,
    scores: scores ? {
      problem_understanding: scores.problem_understanding,
      solution_approach: scores.solution_approach,
      calculation_accuracy: scores.calculation_accuracy,
      presentation_clarity: scores.presentation_clarity,
      total_score: scores.total_score
    } : null,
    teacherFeedback: feedbacks || [],
    checklistItems: checklistItems || [],
    studentReflection: studentReflection ? {
      reflection_text: studentReflection.reflection_text,
      self_assessment: studentReflection.self_assessment,
      areas_for_improvement: studentReflection.areas_for_improvement
    } : null
  }

  return (
    <div className="min-h-screen bg-gray-100">
      <div className="container mx-auto px-4 py-8">
        {/* 헤더 */}
        <div className="bg-white rounded-lg shadow-md p-6 mb-6">
          <div className="flex justify-between items-center">
            <div>
              <h1 className="text-2xl font-bold text-gray-800">학습 피드백</h1>
              <p className="text-gray-600">
                {formatDate(feedbackData.slot.date)} {getBlockTime(feedbackData.slot.block)} | 
                {feedbackData.teacher.name} 선생님
              </p>
            </div>
            <Link 
              href="/dashboard/student/history"
              className="px-4 py-2 bg-gray-500 text-white rounded-lg hover:bg-gray-600 transition-colors"
            >
              히스토리로 돌아가기
            </Link>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* 문제 정보 */}
          {feedbackData.problemSnapshot && (
            <div className="bg-white rounded-lg shadow-md p-6">
              <h2 className="text-xl font-bold text-gray-800 mb-4">문제 정보</h2>
              <div className="space-y-3">
                <div>
                  <h3 className="font-medium text-gray-700">문제 제목</h3>
                  <p className="text-gray-900">{feedbackData.problemSnapshot.title}</p>
                </div>
                <div className="flex space-x-4">
                  <div>
                    <h3 className="font-medium text-gray-700">난이도</h3>
                    <span className={`px-2 py-1 text-xs rounded ${
                      feedbackData.problemSnapshot.difficulty_level <= 2 ? 'bg-green-100 text-green-700' :
                      feedbackData.problemSnapshot.difficulty_level <= 3 ? 'bg-yellow-100 text-yellow-700' :
                      'bg-red-100 text-red-700'
                    }`}>
                      Level {feedbackData.problemSnapshot.difficulty_level}
                    </span>
                  </div>
                  <div>
                    <h3 className="font-medium text-gray-700">영역</h3>
                    <span className="px-2 py-1 bg-blue-100 text-blue-700 text-xs rounded">
                      {feedbackData.problemSnapshot.subject_area}
                    </span>
                  </div>
                </div>
                <div>
                  <h3 className="font-medium text-gray-700">문제 내용</h3>
                  <div className="bg-gray-50 p-4 rounded mt-2">
                    <pre className="whitespace-pre-wrap text-sm text-gray-800">
                      {feedbackData.problemSnapshot.content}
                    </pre>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* 점수 및 평가 */}
          {feedbackData.scores && (
            <div className="bg-white rounded-lg shadow-md p-6">
              <h2 className="text-xl font-bold text-gray-800 mb-4">점수 및 평가</h2>
              <div className="space-y-4">
                <div className="text-center bg-blue-50 p-4 rounded-lg">
                  <p className="text-sm text-gray-600">총점</p>
                  <p className="text-3xl font-bold text-blue-600">
                    {feedbackData.scores.total_score}/20
                  </p>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="text-center">
                    <p className="text-sm text-gray-600">문제 이해</p>
                    <p className={`text-lg font-semibold ${getScoreColor(feedbackData.scores.problem_understanding)}`}>
                      {feedbackData.scores.problem_understanding}/5
                    </p>
                  </div>
                  <div className="text-center">
                    <p className="text-sm text-gray-600">해결 접근</p>
                    <p className={`text-lg font-semibold ${getScoreColor(feedbackData.scores.solution_approach)}`}>
                      {feedbackData.scores.solution_approach}/5
                    </p>
                  </div>
                  <div className="text-center">
                    <p className="text-sm text-gray-600">계산 정확도</p>
                    <p className={`text-lg font-semibold ${getScoreColor(feedbackData.scores.calculation_accuracy)}`}>
                      {feedbackData.scores.calculation_accuracy}/5
                    </p>
                  </div>
                  <div className="text-center">
                    <p className="text-sm text-gray-600">풀이 설명</p>
                    <p className={`text-lg font-semibold ${getScoreColor(feedbackData.scores.presentation_clarity)}`}>
                      {feedbackData.scores.presentation_clarity}/5
                    </p>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* 교사 피드백 */}
          <div className="bg-white rounded-lg shadow-md p-6">
            <h2 className="text-xl font-bold text-gray-800 mb-4">교사 피드백</h2>
            {feedbackData.teacherFeedback.length === 0 ? (
              <p className="text-gray-500">아직 피드백이 등록되지 않았습니다.</p>
            ) : (
              <div className="space-y-4">
                {feedbackData.teacherFeedback.map((feedback) => (
                  <div key={feedback.id} className="bg-gray-50 p-4 rounded-lg">
                    <div className="flex justify-between items-start mb-2">
                      <span className="px-2 py-1 bg-blue-100 text-blue-700 text-xs rounded">
                        {feedback.feedback_type}
                      </span>
                      <span className="text-xs text-gray-500">
                        {new Date(feedback.created_at).toLocaleDateString('ko-KR')}
                      </span>
                    </div>
                    <p className="text-gray-800 whitespace-pre-wrap">
                      {feedback.content}
                    </p>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* 체크리스트 */}
          <div className="bg-white rounded-lg shadow-md p-6">
            <h2 className="text-xl font-bold text-gray-800 mb-4">학습 체크리스트</h2>
            {feedbackData.checklistItems.length === 0 ? (
              <p className="text-gray-500">체크리스트 항목이 없습니다.</p>
            ) : (
              <div className="space-y-3">
                {feedbackData.checklistItems.map((item) => (
                  <div key={item.id} className="flex items-center space-x-3">
                    <div className={`w-5 h-5 rounded border-2 flex items-center justify-center ${
                      item.is_checked ? 'bg-green-500 border-green-500' : 'border-gray-300'
                    }`}>
                      {item.is_checked && (
                        <svg className="w-3 h-3 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7"></path>
                        </svg>
                      )}
                    </div>
                    <p className={`${item.is_checked ? 'text-gray-600 line-through' : 'text-gray-800'}`}>
                      {item.item_text}
                    </p>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* 학생 복기 */}
          {feedbackData.studentReflection && (
            <div className="bg-white rounded-lg shadow-md p-6 lg:col-span-2">
              <h2 className="text-xl font-bold text-gray-800 mb-4">나의 학습 복기</h2>
              <div className="space-y-4">
                <div>
                  <h3 className="font-medium text-gray-700 mb-2">자기평가</h3>
                  <div className="flex items-center space-x-2">
                    {[1, 2, 3, 4, 5].map((star) => (
                      <svg
                        key={star}
                        className={`w-6 h-6 ${
                          star <= feedbackData.studentReflection!.self_assessment
                            ? 'text-yellow-400'
                            : 'text-gray-300'
                        }`}
                        fill="currentColor"
                        viewBox="0 0 20 20"
                      >
                        <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                      </svg>
                    ))}
                    <span className="text-sm text-gray-600 ml-2">
                      ({feedbackData.studentReflection.self_assessment}/5)
                    </span>
                  </div>
                </div>
                <div>
                  <h3 className="font-medium text-gray-700 mb-2">학습 소감</h3>
                  <div className="bg-gray-50 p-4 rounded-lg">
                    <p className="text-gray-800 whitespace-pre-wrap">
                      {feedbackData.studentReflection.reflection_text}
                    </p>
                  </div>
                </div>
                <div>
                  <h3 className="font-medium text-gray-700 mb-2">개선할 점</h3>
                  <div className="bg-gray-50 p-4 rounded-lg">
                    <p className="text-gray-800 whitespace-pre-wrap">
                      {feedbackData.studentReflection.areas_for_improvement}
                    </p>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* 세션 정보 푸터 */}
        <div className="mt-6 text-center text-sm text-gray-500">
          세션 ID: {feedbackData.sessionId} | 
          학습 시작: {new Date(feedbackData.startedAt).toLocaleString('ko-KR')} | 
          완료: {new Date(feedbackData.completedAt).toLocaleString('ko-KR')}
        </div>
      </div>
    </div>
  )
}