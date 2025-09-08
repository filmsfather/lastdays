import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

interface User {
  id: number
  name: string
  class_name: string
  role: string
}

interface FeedbackHistory {
  session_id: number
  date: string
  block: number
  problem_title: string
  problem_subject_area: string
  problem_difficulty_level: number
  score: number | null
  feedback: string | null
  reflection: string | null
  checklist_completed: number
  checklist_total: number
  session_status: string
  created_at: string
}

interface StudentDetail {
  id: number
  name: string
  class_name: string
  remaining_tickets: number
  total_sessions: number
  feedback_history: FeedbackHistory[]
}

async function getCurrentUser(): Promise<User | null> {
  try {
    const cookieStore = await cookies()
    const sessionCookie = cookieStore.get('session')
    const userCookie = cookieStore.get('user')
    
    if (!sessionCookie || !userCookie) {
      return null
    }

    const userInfo = JSON.parse(userCookie.value)
    
    return {
      id: userInfo.id,
      name: userInfo.name,
      class_name: userInfo.className,
      role: userInfo.role
    }
  } catch (error) {
    console.error('사용자 정보 조회 실패:', error)
    return null
  }
}

async function getStudentDetail(studentId: string): Promise<StudentDetail | null> {
  try {
    // 학생 기본 정보 조회
    const { data: student, error: studentError } = await supabase
      .from('accounts')
      .select('id, name, class_name, remaining_tickets')
      .eq('id', parseInt(studentId))
      .eq('role', 'student')
      .single()

    if (studentError || !student) {
      console.error('학생 정보 조회 실패:', studentError)
      return null
    }

    // 학생의 세션 히스토리 조회
    const { data: sessions, error: sessionsError } = await supabase
      .from('sessions')
      .select(`
        id,
        status,
        started_at,
        completed_at,
        created_at,
        reservation:reservation_id (
          slot:slot_id (
            date,
            session_period
          )
        ),
        problem:problem_id (
          title,
          subject_area,
          difficulty_level
        ),
        score:scores (
          total_score
        ),
        feedback:feedbacks (
          content
        ),
        reflection:student_reflections (
          reflection_text
        ),
        checklist:checklist_items (
          id,
          is_checked
        )
      `)
      .eq('reservation.student_id', parseInt(studentId))
      .eq('status', 'completed')
      .order('completed_at', { ascending: false })
      .limit(20)

    // 피드백 히스토리 포맷팅
    const feedbackHistory: FeedbackHistory[] = (sessions || []).map((session: any) => ({
      session_id: session.id,
      date: session.reservation?.slot?.date || '',
      block: session.reservation?.slot?.session_period === 'AM' ? 1 : 2,
      problem_title: session.problem?.title || '문제 제목',
      problem_subject_area: session.problem?.subject_area || '일반',
      problem_difficulty_level: session.problem?.difficulty_level || 1,
      score: session.score?.[0]?.total_score || null,
      feedback: session.feedback?.[0]?.content || null,
      reflection: session.reflection?.[0]?.reflection_text || null,
      checklist_completed: session.checklist?.filter((item: any) => item.is_checked).length || 0,
      checklist_total: session.checklist?.length || 0,
      session_status: session.status,
      created_at: session.created_at
    }))

    // 총 세션 수 계산
    const { count: totalSessions } = await supabase
      .from('sessions')
      .select('*', { count: 'exact' })
      .eq('reservation.student_id', parseInt(studentId))
      .eq('status', 'completed')

    return {
      id: student.id,
      name: student.name,
      class_name: student.class_name,
      remaining_tickets: student.remaining_tickets || 0,
      total_sessions: totalSessions || 0,
      feedback_history: feedbackHistory
    }
  } catch (error) {
    console.error('학생 상세 정보 조회 실패:', error)
    return null
  }
}

// 블록 시간 변환
function getBlockTime(block: number): string {
  const times = [
    '', '09:00-09:40', '09:50-10:30', '10:40-11:20', '11:30-12:10', '12:20-13:00',
    '13:10-13:50', '14:00-14:40', '14:50-15:30', '15:40-16:20', '16:30-17:10'
  ]
  return times[block] || `${block}교시`
}

// 배지 표시
function getBadgeDisplay(badgeType: string) {
  switch (badgeType) {
    case 'perfect_score':
      return { icon: '⭐', color: 'text-yellow-600', label: '만점' }
    case 'first_try':
      return { icon: '🎯', color: 'text-green-600', label: '일발' }
    case 'improvement':
      return { icon: '📈', color: 'text-blue-600', label: '향상' }
    case 'consistency':
      return { icon: '🔥', color: 'text-red-600', label: '꾸준' }
    case 'hard_problem':
      return { icon: '💪', color: 'text-purple-600', label: '도전' }
    default:
      return { icon: '🏆', color: 'text-gray-600', label: '기타' }
  }
}

// 점수에 따른 색상
function getScoreColor(score: number | null) {
  if (score === null) return 'text-gray-500'
  if (score >= 90) return 'text-green-600'
  if (score >= 70) return 'text-blue-600'
  if (score >= 50) return 'text-yellow-600'
  return 'text-red-600'
}

// 날짜 포맷팅
function formatDate(dateString: string) {
  const date = new Date(dateString)
  return date.toLocaleDateString('ko-KR', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    weekday: 'short'
  })
}

// 시간 포맷팅 (상대적)
function formatRelativeTime(dateString: string) {
  const date = new Date(dateString)
  const now = new Date()
  const diffInDays = Math.floor((now.getTime() - date.getTime()) / (1000 * 60 * 60 * 24))
  
  if (diffInDays === 0) return '오늘'
  if (diffInDays === 1) return '어제'
  if (diffInDays <= 7) return `${diffInDays}일 전`
  if (diffInDays <= 30) return `${Math.floor(diffInDays / 7)}주 전`
  return `${Math.floor(diffInDays / 30)}개월 전`
}

interface Props {
  params: Promise<{
    studentId: string
  }>
}

export default async function StudentDetailPage({ params }: Props) {
  const resolvedParams = await params
  const user = await getCurrentUser()
  
  if (!user || user.role !== 'teacher') {
    redirect('/login')
  }

  const student = await getStudentDetail(resolvedParams.studentId)

  if (!student) {
    redirect('/dashboard/teacher/students')
  }

  return (
    <div className="min-h-screen bg-gray-100">
      <div className="container mx-auto px-4 py-8">
        {/* 헤더 */}
        <div className="bg-white rounded-lg shadow-md p-6 mb-6">
          <div className="flex justify-between items-center">
            <div>
              <div className="flex items-center space-x-2">
                <Link 
                  href="/dashboard/teacher/students"
                  className="text-blue-600 hover:text-blue-800"
                >
                  ← 학생 목록
                </Link>
              </div>
              <h1 className="text-2xl font-bold text-gray-800 mt-2">
                {student.name} 학생 상세
              </h1>
              <p className="text-gray-600">{student.class_name}</p>
            </div>
            <div className="flex space-x-4">
              <Link 
                href="/dashboard/teacher/today"
                className="px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors"
              >
                오늘 스케줄
              </Link>
            </div>
          </div>
        </div>

        {/* 학생 통계 */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
          <div className="bg-white rounded-lg shadow-md p-6">
            <h3 className="text-lg font-semibold text-gray-800 mb-2">보유 이용권</h3>
            <p className={`text-3xl font-bold ${
              student.remaining_tickets >= 5 
                ? 'text-green-600' 
                : student.remaining_tickets >= 2
                ? 'text-yellow-600'
                : 'text-red-600'
            }`}>
              {student.remaining_tickets}장
            </p>
          </div>
          <div className="bg-white rounded-lg shadow-md p-6">
            <h3 className="text-lg font-semibold text-gray-800 mb-2">총 세션</h3>
            <p className="text-3xl font-bold text-blue-600">{student.total_sessions}회</p>
          </div>
          <div className="bg-white rounded-lg shadow-md p-6">
            <h3 className="text-lg font-semibold text-gray-800 mb-2">완료율</h3>
            <p className="text-3xl font-bold text-purple-600">
              {student.total_sessions > 0 
                ? Math.round(
                    (student.feedback_history.filter(h => h.session_status === 'completed').length / student.total_sessions) * 100
                  )
                : 0
              }%
            </p>
          </div>
          <div className="bg-white rounded-lg shadow-md p-6">
            <h3 className="text-lg font-semibold text-gray-800 mb-2">평균 점수</h3>
            <p className="text-3xl font-bold text-orange-600">
              {student.feedback_history.filter(h => h.score !== null).length > 0
                ? Math.round(
                    student.feedback_history
                      .filter(h => h.score !== null)
                      .reduce((sum, h) => sum + (h.score || 0), 0) / 
                    student.feedback_history.filter(h => h.score !== null).length
                  )
                : 0
              }점
            </p>
          </div>
        </div>

        {/* 배지 시스템 제거됨 */}

        {/* 피드백 히스토리 */}
        <div className="bg-white rounded-lg shadow-md p-6">
          <h3 className="text-xl font-semibold text-gray-800 mb-4">
            피드백 히스토리 (최근 50건)
          </h3>
          
          {student.feedback_history.length === 0 ? (
            <div className="text-center py-8">
              <div className="text-gray-400 mb-4">
                <svg className="mx-auto h-12 w-12" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M9 11H7v2h2v-2zm4 0h-2v2h2v-2zm4 0h-2v2h2v-2zm2-7h-1V2h-2v2H8V2H6v2H5c-1.11 0-1.99.9-1.99 2L3 20c0 1.1.89 2 2 2h14c1.1 0 2-.9 2-2V6c0-1.1-.9-2-2-2zm0 16H5V9h14v11z"/>
                </svg>
              </div>
              <h4 className="text-lg font-medium text-gray-600 mb-2">
                아직 피드백 기록이 없습니다
              </h4>
              <p className="text-gray-500">
                학생이 문제를 풀고 세션을 완료하면 여기에 표시됩니다
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              {student.feedback_history.map((feedback, index) => (
                <div key={feedback.session_id} className="border border-gray-200 rounded-lg p-4 hover:border-gray-300 transition-colors">
                  <div className="flex justify-between items-start mb-3">
                    <div className="flex-1">
                      <div className="flex items-center space-x-3 mb-2">
                        <h4 className="font-medium text-gray-800">
                          {feedback.problem_title}
                        </h4>
                        <span className="px-2 py-1 bg-gray-100 text-gray-700 text-xs rounded">
                          {feedback.problem_subject_area}
                        </span>
                        <span className={`px-2 py-1 text-xs rounded ${
                          feedback.problem_difficulty_level <= 2 ? 'bg-green-100 text-green-700' :
                          feedback.problem_difficulty_level <= 3 ? 'bg-yellow-100 text-yellow-700' :
                          'bg-red-100 text-red-700'
                        }`}>
                          난이도 {feedback.problem_difficulty_level}
                        </span>
                      </div>
                      <div className="flex items-center space-x-4 text-sm text-gray-600">
                        <span>{formatDate(feedback.date)} {getBlockTime(feedback.block)}</span>
                        <span>{formatRelativeTime(feedback.created_at)}</span>
                      </div>
                    </div>
                    <div className="text-right">
                      {feedback.score !== null ? (
                        <p className={`text-2xl font-bold ${getScoreColor(feedback.score)}`}>
                          {feedback.score}점
                        </p>
                      ) : (
                        <p className="text-gray-500 text-sm">미채점</p>
                      )}
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-3">
                    {/* 피드백 */}
                    <div>
                      <h5 className="text-sm font-medium text-gray-700 mb-1">교사 피드백</h5>
                      <div className="bg-gray-50 rounded p-3 text-sm">
                        {feedback.feedback ? (
                          <p className="text-gray-800">{feedback.feedback}</p>
                        ) : (
                          <p className="text-gray-500 italic">피드백이 작성되지 않았습니다</p>
                        )}
                      </div>
                    </div>

                    {/* 학생 성찰 */}
                    <div>
                      <h5 className="text-sm font-medium text-gray-700 mb-1">학생 성찰</h5>
                      <div className="bg-blue-50 rounded p-3 text-sm">
                        {feedback.reflection ? (
                          <p className="text-gray-800">{feedback.reflection}</p>
                        ) : (
                          <p className="text-gray-500 italic">성찰이 작성되지 않았습니다</p>
                        )}
                      </div>
                    </div>
                  </div>

                  <div className="flex justify-between items-center">
                    <div className="flex items-center space-x-4">
                      <div className="text-xs text-gray-600">
                        체크리스트: {feedback.checklist_completed}/{feedback.checklist_total} 완료
                        <div className="w-20 bg-gray-200 rounded-full h-2 mt-1">
                          <div 
                            className="bg-blue-600 h-2 rounded-full" 
                            style={{ width: `${feedback.checklist_total > 0 ? (feedback.checklist_completed / feedback.checklist_total) * 100 : 0}%` }}
                          ></div>
                        </div>
                      </div>
                      <span className={`px-2 py-1 text-xs rounded ${
                        feedback.session_status === 'completed' ? 'bg-green-100 text-green-800' :
                        feedback.session_status === 'in_progress' ? 'bg-blue-100 text-blue-800' :
                        'bg-gray-100 text-gray-800'
                      }`}>
                        {feedback.session_status === 'completed' ? '완료' :
                         feedback.session_status === 'in_progress' ? '진행중' : '대기중'}
                      </span>
                    </div>

                    <Link
                      href={`/session/${feedback.session_id}/feedback`}
                      className="px-3 py-1 bg-blue-500 text-white text-sm rounded hover:bg-blue-600 transition-colors"
                    >
                      상세보기
                    </Link>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* 하단 도움말 */}
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mt-6">
          <h4 className="font-medium text-blue-800 mb-2">도움말</h4>
          <div className="text-sm text-blue-700 space-y-1">
            <p>• 각 피드백 기록을 클릭하면 해당 세션의 상세 정보를 확인할 수 있습니다</p>
            <p>• 점수 색상: <span className="text-green-600 font-medium">초록(90점 이상)</span>, <span className="text-blue-600 font-medium">파랑(70-89점)</span>, <span className="text-yellow-600 font-medium">노랑(50-69점)</span>, <span className="text-red-600 font-medium">빨강(49점 이하)</span></p>
            <p>• 최근 50건의 기록만 표시됩니다</p>
          </div>
        </div>
      </div>
    </div>
  )
}