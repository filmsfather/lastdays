import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import Link from 'next/link'

interface User {
  id: number
  name: string
  class_name: string
  role: string
}

interface StudentWithStats {
  id: number
  name: string
  class_name: string
  remaining_tickets: number
  recent_badges: {
    badge_type: string
    earned_at: string
  }[]
}

interface ClassSection {
  class_name: string
  students: StudentWithStats[]
}

async function getCurrentUser(): Promise<User | null> {
  // 개발환경에서는 테스트용 교사 사용자 반환
  if (process.env.NODE_ENV === 'development') {
    return {
      id: 14,  // 실제 Supabase의 교사 ID
      name: '김선생',
      class_name: '수학교사',
      role: 'teacher'
    }
  }
  
  // 프로덕션에서는 정상 인증 로직
  try {
    const cookieStore = await cookies()
    const authCookie = cookieStore.get('auth')
    
    if (!authCookie) {
      return null
    }

    const response = await fetch(`${process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3006'}/api/auth/me`, {
      headers: {
        'Cookie': `auth=${authCookie.value}`
      }
    })

    const data = await response.json()
    return data.success ? data.user : null
  } catch (error) {
    console.error('사용자 정보 조회 실패:', error)
    return null
  }
}

async function getStudentsByClass(): Promise<ClassSection[]> {
  try {
    const response = await fetch(`${process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3006'}/api/teacher/students`, {
      credentials: 'include',  // 쿠키 포함
      cache: 'no-store' // 실시간 데이터
    })

    const data = await response.json()
    return data.success ? data.classStats : []
  } catch (error) {
    console.error('학생 데이터 조회 실패:', error)
    return []
  }
}

// 배지 타입에 따른 아이콘과 색상
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

export default async function TeacherStudentsPage() {
  const user = await getCurrentUser()
  
  if (!user || user.role !== 'teacher') {
    redirect('/login')
  }

  const classSections = await getStudentsByClass()

  return (
    <div className="min-h-screen bg-gray-100">
      <div className="container mx-auto px-4 py-8">
        {/* 헤더 */}
        <div className="bg-white rounded-lg shadow-md p-6 mb-6">
          <div className="flex justify-between items-center">
            <div>
              <h1 className="text-2xl font-bold text-gray-800">
                학생 관리
              </h1>
              <p className="text-gray-600">반별 학생 현황 및 관리</p>
              <p className="text-sm text-gray-500">{user.name} 선생님 • {user.class_name}</p>
            </div>
            <div className="flex space-x-4">
              <Link 
                href="/dashboard/teacher/today"
                className="px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors"
              >
                오늘 스케줄
              </Link>
              <Link 
                href="/dashboard/teacher"
                className="px-4 py-2 bg-gray-500 text-white rounded-lg hover:bg-gray-600 transition-colors"
              >
                메인 대시보드
              </Link>
            </div>
          </div>
        </div>

        {/* 전체 통계 */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
          <div className="bg-white rounded-lg shadow-md p-6">
            <h3 className="text-lg font-semibold text-gray-800 mb-2">전체 반 수</h3>
            <p className="text-3xl font-bold text-blue-600">{classSections.length}개 반</p>
          </div>
          <div className="bg-white rounded-lg shadow-md p-6">
            <h3 className="text-lg font-semibold text-gray-800 mb-2">전체 학생 수</h3>
            <p className="text-3xl font-bold text-green-600">
              {classSections.reduce((total, section) => total + section.students.length, 0)}명
            </p>
          </div>
          <div className="bg-white rounded-lg shadow-md p-6">
            <h3 className="text-lg font-semibold text-gray-800 mb-2">평균 이용권</h3>
            <p className="text-3xl font-bold text-purple-600">
              {classSections.length > 0 
                ? Math.round(
                    classSections.reduce((total, section) => 
                      total + section.students.reduce((sectionTotal, student) => 
                        sectionTotal + student.remaining_tickets, 0
                      ), 0
                    ) / classSections.reduce((total, section) => total + section.students.length, 0)
                  )
                : 0
              }장
            </p>
          </div>
        </div>

        {/* 반별 학생 목록 */}
        {classSections.length === 0 ? (
          <div className="bg-white rounded-lg shadow-md p-8 text-center">
            <div className="text-gray-400 mb-4">
              <svg className="mx-auto h-12 w-12" fill="currentColor" viewBox="0 0 24 24">
                <path d="M16 4c0-1.11.89-2 2-2s2 .89 2 2-.89 2-2 2-2-.89-2-2zM4 18v-4h3v4h2v-4h3v4h2v-4h3v4h2V8H2v10h2z"/>
              </svg>
            </div>
            <h3 className="text-lg font-medium text-gray-600 mb-2">
              등록된 학생이 없습니다
            </h3>
            <p className="text-gray-500">
              학생들이 가입하면 여기에 표시됩니다
            </p>
          </div>
        ) : (
          <div className="space-y-6">
            {classSections.map((section) => (
              <div key={section.class_name} className="bg-white rounded-lg shadow-md">
                {/* 반 헤더 */}
                <div className="px-6 py-4 border-b border-gray-200">
                  <div className="flex justify-between items-center">
                    <h2 className="text-xl font-semibold text-gray-800">
                      {section.class_name}
                    </h2>
                    <span className="px-3 py-1 bg-blue-100 text-blue-800 rounded-full text-sm font-medium">
                      {section.students.length}명
                    </span>
                  </div>
                </div>

                {/* 학생 목록 */}
                <div className="p-6">
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {section.students.map((student) => (
                      <Link
                        key={student.id}
                        href={`/dashboard/teacher/students/${student.id}`}
                        className="block p-4 border border-gray-200 rounded-lg hover:border-blue-300 hover:shadow-md transition-all cursor-pointer"
                      >
                        <div className="flex justify-between items-start mb-3">
                          <div>
                            <h3 className="font-semibold text-gray-800 text-lg">
                              {student.name}
                            </h3>
                            <p className="text-sm text-gray-600">
                              {student.class_name}
                            </p>
                          </div>
                          <div className="text-right">
                            <p className="text-xs text-gray-500">보유 이용권</p>
                            <p className={`text-lg font-bold ${
                              student.remaining_tickets >= 5 
                                ? 'text-green-600' 
                                : student.remaining_tickets >= 2
                                ? 'text-yellow-600'
                                : 'text-red-600'
                            }`}>
                              {student.remaining_tickets}장
                            </p>
                          </div>
                        </div>

                        {/* 최근 배지 */}
                        <div>
                          <p className="text-xs text-gray-500 mb-2">최근 배지 (3개)</p>
                          <div className="flex space-x-2">
                            {student.recent_badges.length === 0 ? (
                              <span className="text-xs text-gray-400">배지 없음</span>
                            ) : (
                              student.recent_badges.slice(0, 3).map((badge, index) => {
                                const display = getBadgeDisplay(badge.badge_type)
                                return (
                                  <div
                                    key={index}
                                    className="flex items-center space-x-1 px-2 py-1 bg-gray-50 rounded-full"
                                    title={`${display.label} (${new Date(badge.earned_at).toLocaleDateString('ko-KR')})`}
                                  >
                                    <span className="text-sm">{display.icon}</span>
                                    <span className={`text-xs font-medium ${display.color}`}>
                                      {display.label}
                                    </span>
                                  </div>
                                )
                              })
                            )}
                          </div>
                        </div>

                        {/* 호버 표시 */}
                        <div className="mt-3 text-right">
                          <span className="text-xs text-blue-500">
                            자세히 보기 →
                          </span>
                        </div>
                      </Link>
                    ))}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* 하단 도움말 */}
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mt-6">
          <h4 className="font-medium text-blue-800 mb-2">도움말</h4>
          <div className="text-sm text-blue-700 space-y-1">
            <p>• 각 학생 카드를 클릭하면 상세한 피드백 히스토리를 확인할 수 있습니다</p>
            <p>• 이용권 색상: <span className="text-green-600 font-medium">초록(5장 이상)</span>, <span className="text-yellow-600 font-medium">노랑(2-4장)</span>, <span className="text-red-600 font-medium">빨강(1장 이하)</span></p>
            <p>• 배지는 학생의 최근 성취를 나타냅니다 (만점, 일발, 향상, 꾸준, 도전)</p>
          </div>
        </div>
      </div>
    </div>
  )
}