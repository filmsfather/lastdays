import { redirect } from 'next/navigation'
import Link from 'next/link'
import { getCurrentUser } from '@/lib/auth'
import { supabase } from '@/lib/supabase'

// 점수에 따른 색상 반환
const getScoreColor = (score: string) => {
  if (score === '상') return 'text-green-600'
  if (score === '중상') return 'text-blue-600'
  if (score === '중') return 'text-yellow-600'
  if (score === '중하') return 'text-orange-600'
  if (score === '하') return 'text-red-600'
  return 'text-gray-600'
}

// 날짜 포맷팅
const formatDate = (dateString: string) => {
  const date = new Date(dateString)
  return date.toLocaleDateString('ko-KR', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    weekday: 'short'
  })
}

// 세션 시간대 표시
const getSessionPeriodTime = (period: string) => {
  return period === 'AM' ? '오전' : '오후'
}

interface HallOfFameSession {
  id: number
  date: string
  sessionPeriod: 'AM' | 'PM'
  studentName: string
  studentClass: string
  teacherName: string
  teacherClass: string
  problemTitle: string
  limitMinutes: number
  completedAt: string
  scores: {
    practical_skills: string
    major_knowledge: string
    major_suitability: string
    attitude: string
  }
}

export default async function HallOfFamePage() {
  // 사용자 인증 확인 (모든 역할 허용)
  const currentUser = await getCurrentUser()
  if (!currentUser) {
    redirect('/login')
  }

  // 명예의 전당 데이터 조회 (서버사이드에서 직접)
  let hallOfFameData: HallOfFameSession[] = []
  
  try {
    // 우수한 점수를 받은 완료된 세션들 조회
    const { data: sessions, error } = await supabase
      .from('sessions')
      .select(`
        id,
        status,
        completed_at,
        scores (
          practical_skills,
          major_knowledge,
          major_suitability,
          attitude
        ),
        reservation:reservation_id (
          student:student_id (
            name,
            class_name
          ),
          slot:slot_id (
            date,
            session_period,
            teacher:teacher_id (
              name,
              class_name
            )
          )
        ),
        problem:problem_id (
          title,
          limit_minutes
        )
      `)
      .eq('status', 'completed')
      .not('scores', 'is', null) // 점수가 있는 세션만
      .order('completed_at', { ascending: false })
      .limit(100) // 최대 100건

    if (!error && sessions) {
      // 우수한 점수만 필터링
      const excellentSessions = sessions.filter(session => {
        const scores = Array.isArray(session.scores) ? session.scores[0] : session.scores
        if (!scores) return false

        const scoreValues = [
          scores.practical_skills,
          scores.major_knowledge,
          scores.major_suitability,
          scores.attitude
        ]

        // 모든 점수가 '상' 또는 최대 1개만 '중상'인 경우
        const 상Count = scoreValues.filter(s => s === '상').length
        const 중상Count = scoreValues.filter(s => s === '중상').length

        return 상Count >= 3 && (상Count === 4 || 중상Count === 1)
      })

      // 응답 데이터 구성
      hallOfFameData = excellentSessions.map(session => {
        const scores = Array.isArray(session.scores) ? session.scores[0] : session.scores
        const problem = Array.isArray(session.problem) ? session.problem[0] : session.problem
        return {
          id: session.id,
          date: (session.reservation as any).slot.date,
          sessionPeriod: (session.reservation as any).slot.session_period,
          studentName: (session.reservation as any).student.name,
          studentClass: (session.reservation as any).student.class_name,
          teacherName: (session.reservation as any).slot.teacher.name,
          teacherClass: (session.reservation as any).slot.teacher.class_name,
          problemTitle: problem?.title || '문제 정보 없음',
          limitMinutes: problem?.limit_minutes || 0,
          completedAt: session.completed_at,
          scores: {
            practical_skills: scores?.practical_skills || '',
            major_knowledge: scores?.major_knowledge || '',
            major_suitability: scores?.major_suitability || '',
            attitude: scores?.attitude || ''
          }
        }
      })
    }
  } catch (error) {
    console.error('Hall of Fame data fetch error:', error)
    hallOfFameData = []
  }

  // 사용자 역할에 따른 대시보드 경로
  const getDashboardPath = () => {
    if (currentUser.role === 'student') return '/dashboard/student'
    if (currentUser.role === 'teacher') return '/dashboard/teacher'
    if (currentUser.role === 'admin') return '/dashboard/admin'
    return '/dashboard/student' // fallback
  }

  return (
    <div className="min-h-screen bg-gray-100">
      <div className="container mx-auto px-4 py-8">
        {/* 헤더 */}
        <div className="bg-white rounded-lg shadow-md p-6 mb-6">
          <div className="flex justify-between items-center">
            <div>
              <h1 className="text-2xl font-bold text-gray-800 flex items-center">
                <div className="w-10 h-10 bg-yellow-100 rounded-xl flex items-center justify-center mr-3">
                  <svg className="w-6 h-6 text-yellow-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 3v4M3 5h4M6 17v4m-2-2h4m5-16l2.286 6.857L21 12l-5.714 2.143L13 21l-2.286-6.857L5 12l5.714-2.143L13 3z" />
                  </svg>
                </div>
                명예의 전당 🏆
              </h1>
              <p className="text-gray-600">우수한 성과를 거둔 학습 세션들을 확인해보세요</p>
            </div>
            <Link 
              href={getDashboardPath()}
              className="px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors"
            >
              대시보드로 돌아가기
            </Link>
          </div>
        </div>

        {/* 설명 카드 */}
        <div className="bg-gradient-to-r from-yellow-50 to-amber-50 border border-yellow-200 rounded-lg p-4 mb-6">
          <div className="flex items-center">
            <div className="w-8 h-8 bg-yellow-500 rounded-full flex items-center justify-center mr-3">
              <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <p className="text-yellow-800">
              <strong>명예의 전당 기준:</strong> 4개 영역에서 모두 &apos;상&apos; 또는 3개 &apos;상&apos; + 1개 &apos;중상&apos;을 받은 우수한 학습 세션들입니다.
            </p>
          </div>
        </div>

        {/* 명예의 전당 목록 */}
        <div className="bg-white rounded-lg shadow-md overflow-hidden">
          {hallOfFameData.length === 0 ? (
            <div className="p-12 text-center">
              <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <svg className="w-8 h-8 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 3v4M3 5h4M6 17v4m-2-2h4m5-16l2.286 6.857L21 12l-5.714 2.143L13 21l-2.286-6.857L5 12l5.714-2.143L13 3z" />
                </svg>
              </div>
              <h3 className="text-lg font-medium text-gray-600 mb-2">아직 명예의 전당에 등록된 세션이 없습니다</h3>
              <p className="text-gray-500">우수한 성과를 거둔 학습이 등록되면 여기에 표시됩니다.</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gradient-to-r from-yellow-50 to-amber-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-700 uppercase tracking-wider">
                      🏆 랭킹
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-700 uppercase tracking-wider">
                      학생
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-700 uppercase tracking-wider">
                      날짜
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-700 uppercase tracking-wider">
                      담당교사
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-700 uppercase tracking-wider">
                      문제
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-700 uppercase tracking-wider">
                      성과
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-700 uppercase tracking-wider">
                      상세보기
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {hallOfFameData.map((session, index) => (
                    <tr 
                      key={session.id}
                      className="hover:bg-yellow-50 transition-colors"
                    >
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="flex items-center">
                          <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold text-white ${
                            index === 0 ? 'bg-yellow-500' : 
                            index === 1 ? 'bg-gray-400' : 
                            index === 2 ? 'bg-yellow-600' : 'bg-gray-300'
                          }`}>
                            {index + 1}
                          </div>
                          {index < 3 && (
                            <span className="ml-2">
                              {index === 0 ? '🥇' : index === 1 ? '🥈' : '🥉'}
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div>
                          <div className="text-sm font-medium text-gray-900">{session.studentName}</div>
                          <div className="text-sm text-gray-500">{session.studentClass}</div>
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        <div>
                          <div>{formatDate(session.date)}</div>
                          <div className="text-gray-500">{getSessionPeriodTime(session.sessionPeriod)}</div>
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div>
                          <div className="text-sm font-medium text-gray-900">{session.teacherName}</div>
                          <div className="text-sm text-gray-500">{session.teacherClass}</div>
                        </div>
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-900 max-w-xs truncate">
                        <div title={session.problemTitle}>
                          {session.problemTitle}
                        </div>
                        <div className="text-xs text-gray-500">{session.limitMinutes}분</div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="grid grid-cols-2 gap-1 text-xs">
                          <span className={`font-medium ${getScoreColor(session.scores.practical_skills)}`}>
                            실기: {session.scores.practical_skills}
                          </span>
                          <span className={`font-medium ${getScoreColor(session.scores.major_knowledge)}`}>
                            전공: {session.scores.major_knowledge}
                          </span>
                          <span className={`font-medium ${getScoreColor(session.scores.major_suitability)}`}>
                            적합성: {session.scores.major_suitability}
                          </span>
                          <span className={`font-medium ${getScoreColor(session.scores.attitude)}`}>
                            태도: {session.scores.attitude}
                          </span>
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm">
                        <Link
                          href={`/session/${session.id}/feedback?hallOfFame=true`}
                          className="text-yellow-600 hover:text-yellow-800 font-medium flex items-center"
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
        {hallOfFameData.length > 0 && (
          <div className="mt-6 text-center text-sm text-gray-500">
            총 {hallOfFameData.length}개의 우수한 학습 세션이 명예의 전당에 등록되어 있습니다.
          </div>
        )}
      </div>
    </div>
  )
}