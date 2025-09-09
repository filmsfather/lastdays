import { getCurrentUser } from '@/lib/auth'
import { supabase } from '@/lib/supabase'
import Link from 'next/link'
import { redirect } from 'next/navigation'

interface SessionHistory {
  id: number
  date: string
  sessionPeriod: string
  teacherName: string
  problemTitle: string
  finalScore: string
  completedAt: string
}

interface SessionData {
  id: number
  status: string
  completed_at: string
  reservation: {
    slot: {
      date: string
      session_period: string
      teacher: {
        name: string
      }
    }
  }
  problem: {
    title: string
  }
  scores: Array<{
    total_score: number
  }>
}

// 세션 시간 변환 함수
const getSessionPeriodTime = (period: string) => {
  return period === 'AM' ? '오전' : '오후'
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

// 점수 결과 색상 가져오기 함수
const getScoreColor = (scoreResult: string) => {
  if (scoreResult === '미채점') {
    return 'text-gray-500'
  }
  
  // 점수가 있는 경우 파란색으로 표시
  return 'text-blue-600 font-semibold'
}

interface Props {
  searchParams: Promise<{
    studentId?: string
  }>
}

export default async function StudentHistoryPage({ searchParams }: Props) {
  // URL 파라미터에서 studentId 추출
  const resolvedParams = await searchParams
  const studentId = resolvedParams?.studentId

  // 사용자 인증 확인
  const currentUser = await getCurrentUser()
  if (!currentUser) {
    redirect('/login')
  }

  // 권한 확인: 학생 본인이거나, 교사가 특정 학생을 조회하는 경우
  const targetStudentId = studentId ? parseInt(studentId) : currentUser.id
  const isOwnHistory = currentUser.id === targetStudentId
  const isTeacherViewing = currentUser.role === 'teacher' && studentId

  if (!isOwnHistory && !isTeacherViewing) {
    redirect('/login')
  }

  // 대상 학생 정보 조회 (교사가 다른 학생을 조회하는 경우)
  let targetStudent = currentUser
  if (isTeacherViewing) {
    const { data: studentData, error: studentError } = await supabase
      .from('accounts')
      .select('id, name, class_name')
      .eq('id', targetStudentId)
      .eq('role', 'student')
      .single()

    if (studentError || !studentData) {
      redirect('/dashboard/teacher/students')
    }
    targetStudent = {
      id: studentData.id,
      name: studentData.name,
      className: studentData.class_name,
      role: 'student'
    }
  }

  // 학생의 완료된 세션 히스토리 조회 (최신 50건)
  const { data: sessions, error } = await supabase
    .from('sessions')
    .select(`
      id,
      status,
      completed_at,
      reservation:reservation_id (
        student_id,
        slot:slot_id (
          date,
          session_period,
          teacher:teacher_id (
            name
          )
        )
      ),
      problem:problem_id (
        title
      ),
      scores (
        practical_skills,
        major_knowledge,
        major_suitability,
        attitude
      )
    `)
    .eq('reservation.student_id', targetStudentId)
    .eq('status', 'completed')
    .order('completed_at', { ascending: false })
    .limit(50)

  if (error) {
    console.error('Error fetching student history:', error)
  }

  const sessionHistory: SessionHistory[] = ((sessions as any[]) || []).map((session: any) => {
    const score = session.scores
    let scoreDisplay = '미채점'
    
    if (score) {
      const scores = [
        score.practical_skills,
        score.major_knowledge,
        score.major_suitability,
        score.attitude
      ].filter(Boolean)
      
      if (scores.length > 0) {
        scoreDisplay = scores.join(' / ')
      }
    }
    
    return {
      id: session.id,
      date: session.reservation?.slot?.date,
      sessionPeriod: session.reservation?.slot?.session_period,
      teacherName: session.reservation?.slot?.teacher?.name,
      problemTitle: session.problem?.title,
      finalScore: scoreDisplay,
      completedAt: session.completed_at
    }
  })

  return (
    <div className="min-h-screen bg-gray-100">
      <div className="container mx-auto px-4 py-8">
        {/* 헤더 */}
        <div className="bg-white rounded-lg shadow-md p-6 mb-6">
          <div className="flex justify-between items-center">
            <div>
              <h1 className="text-2xl font-bold text-gray-800">
                학습 히스토리
                {isTeacherViewing && (
                  <span className="text-lg font-normal text-gray-600 ml-2">
                    - {targetStudent.name} 학생
                  </span>
                )}
              </h1>
              <p className="text-gray-600">
                {targetStudent.name}님의 최근 50건 학습 기록
                {isTeacherViewing && ` (${targetStudent.className})`}
              </p>
            </div>
            <Link 
              href={isTeacherViewing ? "/dashboard/teacher/students" : "/dashboard/student"}
              className="px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors"
            >
              {isTeacherViewing ? "학생 목록으로" : "대시보드로 돌아가기"}
            </Link>
          </div>
        </div>

        {/* 히스토리 테이블 */}
        <div className="bg-white rounded-lg shadow-md overflow-hidden">
          {sessionHistory.length === 0 ? (
            <div className="p-8 text-center">
              <p className="text-gray-500 text-lg">완료된 학습 기록이 없습니다.</p>
              <p className="text-gray-400 mt-2">첫 번째 학습을 시작해보세요!</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      날짜
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      시간대
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      교사명
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      문제 제목
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      채점 결과
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      피드백
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {sessionHistory.map((session) => (
                    <tr 
                      key={session.id}
                      className="hover:bg-gray-50 transition-colors"
                    >
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        {formatDate(session.date)}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        {getSessionPeriodTime(session.sessionPeriod)}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        {session.teacherName} 선생님
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-900 max-w-xs truncate">
                        {session.problemTitle}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm">
                        <span className={getScoreColor(session.finalScore)}>
                          {session.finalScore}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm">
                        <Link
                          href={`/session/${session.id}/feedback`}
                          className="text-blue-600 hover:text-blue-800 font-medium"
                        >
                          상세보기 →
                        </Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* 푸터 정보 */}
        {sessionHistory.length > 0 && (
          <div className="mt-4 text-center text-sm text-gray-500">
            총 {sessionHistory.length}건의 학습 기록을 표시하고 있습니다.
          </div>
        )}
      </div>
    </div>
  )
}