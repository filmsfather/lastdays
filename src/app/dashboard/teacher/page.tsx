'use client'

import { useState, useEffect } from 'react'
import { toast } from 'react-hot-toast'
import Link from 'next/link'

interface User {
  id: number
  name: string
  class_name: string
  role: string
}

interface Problem {
  id: number
  title: string
  subject_area: string
  difficulty_level: number
  status: 'draft' | 'published' | 'archived'
  created_at: string
  updated_at: string
  usage_count?: number
}

interface DashboardStats {
  total_problems: number
  public_problems: number
  private_problems: number
  total_usage: number
  todays_sessions: number
  active_reservations: number
}

export default function TeacherDashboardPage() {
  const [user, setUser] = useState<User | null>(null)
  const [activeTab, setActiveTab] = useState<'overview' | 'problems'>('overview')
  const [problems, setProblems] = useState<Problem[]>([])
  const [stats, setStats] = useState<DashboardStats>({
    total_problems: 0,
    public_problems: 0,
    private_problems: 0,
    total_usage: 0,
    todays_sessions: 0,
    active_reservations: 0
  })
  const [loading, setLoading] = useState(true)

  // 현재 사용자 정보 조회
  useEffect(() => {
    async function fetchCurrentUser() {
      try {
        const response = await fetch('/api/auth/me')
        const data = await response.json()
        
        if (data.success) {
          setUser(data.user)
          if (data.user.role !== 'teacher') {
            toast.error('교사만 접근 가능한 페이지입니다.')
            window.location.href = '/login'
            return
          }
        } else {
          window.location.href = '/login'
          return
        }
      } catch (error) {
        console.error('사용자 정보 조회 실패:', error)
        window.location.href = '/login'
      }
    }

    fetchCurrentUser()
  }, [])

  // 초기 데이터 로드
  useEffect(() => {
    if (!user) return

    async function loadData() {
      setLoading(true)
      try {
        await Promise.all([
          fetchProblems(),
          fetchStats()
        ])
      } catch (error) {
        console.error('데이터 로드 실패:', error)
        toast.error('데이터를 불러오는 중 오류가 발생했습니다.')
      } finally {
        setLoading(false)
      }
    }

    loadData()
  }, [user])

  // 문제 목록 조회
  const fetchProblems = async () => {
    try {
      const response = await fetch('/api/teacher/problems', {
        credentials: 'include'  // 쿠키 포함
      })
      const data = await response.json()
      
      if (data.success) {
        setProblems(data.problems)
      }
    } catch (error) {
      console.error('문제 조회 실패:', error)
    }
  }

  // 통계 조회
  const fetchStats = async () => {
    try {
      const response = await fetch('/api/teacher/dashboard/stats', {
        credentials: 'include'  // 쿠키 포함
      })
      const data = await response.json()
      
      if (data.success) {
        setStats(data.stats)
      }
    } catch (error) {
      console.error('통계 조회 실패:', error)
    }
  }

  // 문제 공개/비공개 토글
  const toggleProblemVisibility = async (problemId: number, isPublic: boolean) => {
    try {
      const response = await fetch(`/api/teacher/problems/${problemId}/publish`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',  // 쿠키 포함
        body: JSON.stringify({
          status: isPublic ? 'draft' : 'published'
        }),
      })

      const data = await response.json()

      if (data.success) {
        toast.success(isPublic ? '문제가 비공개로 변경되었습니다.' : '문제가 공개되었습니다.')
        await fetchProblems()
        await fetchStats()
      } else {
        toast.error(data.error || '상태 변경에 실패했습니다.')
      }
    } catch (error) {
      console.error('문제 상태 변경 실패:', error)
      toast.error('오류가 발생했습니다.')
    }
  }

  // 난이도 색상
  const getDifficultyColor = (level: number) => {
    if (level <= 2) return 'bg-green-100 text-green-700'
    if (level <= 3) return 'bg-yellow-100 text-yellow-700'
    return 'bg-red-100 text-red-700'
  }

  // 날짜 포맷팅
  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('ko-KR', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    })
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-100 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-blue-500 mx-auto"></div>
          <p className="mt-4 text-gray-600">데이터를 불러오는 중...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-100">
      <div className="container mx-auto px-4 py-8">
        {/* 헤더 */}
        <div className="bg-white rounded-lg shadow-md p-6 mb-6">
          <div className="flex justify-between items-center">
            <div>
              <h1 className="text-2xl font-bold text-gray-800">
                교사 대시보드
              </h1>
              <p className="text-gray-600">{user?.name} 선생님 • {user?.class_name}</p>
            </div>
            <div className="flex space-x-4">
              <Link 
                href="/dashboard/teacher/today"
                className="px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors"
              >
                오늘 스케줄
              </Link>
              <Link 
                href="/dashboard/teacher/students"
                className="px-4 py-2 bg-green-500 text-white rounded-lg hover:bg-green-600 transition-colors"
              >
                학생 관리
              </Link>
            </div>
          </div>
        </div>

        {/* 탭 네비게이션 */}
        <div className="bg-white rounded-lg shadow-md mb-6">
          <div className="border-b border-gray-200">
            <nav className="flex space-x-8 px-6">
              <button
                onClick={() => setActiveTab('overview')}
                className={`py-4 px-1 border-b-2 font-medium text-sm transition-colors ${
                  activeTab === 'overview'
                    ? 'border-blue-500 text-blue-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                }`}
              >
                대시보드 개요
              </button>
              <button
                onClick={() => setActiveTab('problems')}
                className={`py-4 px-1 border-b-2 font-medium text-sm transition-colors ${
                  activeTab === 'problems'
                    ? 'border-blue-500 text-blue-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                }`}
              >
                문제 관리
              </button>
            </nav>
          </div>

          {/* 탭 내용 */}
          <div className="p-6">
            {activeTab === 'overview' && (
              <div className="space-y-6">
                {/* 통계 카드 */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="bg-blue-50 rounded-lg p-6">
                    <h3 className="text-lg font-semibold text-blue-800 mb-2">오늘 세션</h3>
                    <p className="text-3xl font-bold text-blue-600">{stats.todays_sessions}개</p>
                    <p className="text-sm text-blue-600 mt-1">진행된 세션 수</p>
                  </div>
                  <div className="bg-green-50 rounded-lg p-6">
                    <h3 className="text-lg font-semibold text-green-800 mb-2">활성 예약</h3>
                    <p className="text-3xl font-bold text-green-600">{stats.active_reservations}개</p>
                    <p className="text-sm text-green-600 mt-1">대기 중인 예약</p>
                  </div>
                  <div className="bg-purple-50 rounded-lg p-6">
                    <h3 className="text-lg font-semibold text-purple-800 mb-2">문제 사용</h3>
                    <p className="text-3xl font-bold text-purple-600">{stats.total_usage}회</p>
                    <p className="text-sm text-purple-600 mt-1">누적 사용 횟수</p>
                  </div>
                </div>

                {/* 문제 통계 */}
                <div className="bg-white rounded-lg border p-6">
                  <h3 className="text-lg font-semibold text-gray-800 mb-4">내 문제 통계</h3>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div className="text-center p-4 bg-gray-50 rounded-lg">
                      <p className="text-2xl font-bold text-gray-800">{stats.total_problems}</p>
                      <p className="text-sm text-gray-600">전체 문제</p>
                    </div>
                    <div className="text-center p-4 bg-green-50 rounded-lg">
                      <p className="text-2xl font-bold text-green-600">{stats.public_problems}</p>
                      <p className="text-sm text-gray-600">공개 문제</p>
                    </div>
                    <div className="text-center p-4 bg-orange-50 rounded-lg">
                      <p className="text-2xl font-bold text-orange-600">{stats.private_problems}</p>
                      <p className="text-sm text-gray-600">비공개 문제</p>
                    </div>
                  </div>
                </div>

                {/* 빠른 링크 */}
                <div className="bg-white rounded-lg border p-6">
                  <h3 className="text-lg font-semibold text-gray-800 mb-4">빠른 바로가기</h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                    <Link
                      href="/dashboard/teacher/today"
                      className="p-4 bg-blue-50 rounded-lg hover:bg-blue-100 transition-colors text-center"
                    >
                      <div className="text-blue-600 font-medium">📅</div>
                      <p className="text-sm text-blue-800 mt-2">오늘 스케줄</p>
                    </Link>
                    <Link
                      href="/dashboard/teacher/students"
                      className="p-4 bg-green-50 rounded-lg hover:bg-green-100 transition-colors text-center"
                    >
                      <div className="text-green-600 font-medium">👥</div>
                      <p className="text-sm text-green-800 mt-2">학생 관리</p>
                    </Link>
                    <button
                      onClick={() => setActiveTab('problems')}
                      className="p-4 bg-purple-50 rounded-lg hover:bg-purple-100 transition-colors text-center"
                    >
                      <div className="text-purple-600 font-medium">📝</div>
                      <p className="text-sm text-purple-800 mt-2">문제 관리</p>
                    </button>
                    <Link
                      href="/dashboard/admin"
                      className="p-4 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors text-center"
                    >
                      <div className="text-gray-600 font-medium">⚙️</div>
                      <p className="text-sm text-gray-800 mt-2">관리자</p>
                    </Link>
                  </div>
                </div>
              </div>
            )}

            {activeTab === 'problems' && (
              <div className="space-y-6">
                {/* 문제 관리 헤더 */}
                <div className="flex justify-between items-center">
                  <div>
                    <h3 className="text-lg font-semibold text-gray-800">문제 목록</h3>
                    <p className="text-gray-600">등록한 문제들을 관리할 수 있습니다</p>
                  </div>
                  <div className="space-x-3">
                    <button
                      onClick={() => window.location.href = '/teacher/problems/new'}
                      className="px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors"
                    >
                      새 문제 등록
                    </button>
                    <button
                      onClick={fetchProblems}
                      className="px-4 py-2 bg-gray-500 text-white rounded-lg hover:bg-gray-600 transition-colors"
                    >
                      새로고침
                    </button>
                  </div>
                </div>

                {/* 문제 목록 */}
                {problems.length === 0 ? (
                  <div className="bg-white border rounded-lg p-8 text-center">
                    <div className="text-gray-400 mb-4">
                      <svg className="mx-auto h-12 w-12" fill="currentColor" viewBox="0 0 24 24">
                        <path d="M14,2H6A2,2 0 0,0 4,4V20A2,2 0 0,0 6,22H18A2,2 0 0,0 20,20V8L14,2M18,20H6V4H13V9H18V20Z" />
                      </svg>
                    </div>
                    <h4 className="text-lg font-medium text-gray-600 mb-2">
                      등록된 문제가 없습니다
                    </h4>
                    <p className="text-gray-500 mb-4">
                      새로운 문제를 등록해서 학생들에게 제공해보세요
                    </p>
                    <button
                      onClick={() => window.location.href = '/teacher/problems/new'}
                      className="px-6 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors"
                    >
                      첫 문제 등록하기
                    </button>
                  </div>
                ) : (
                  <div className="bg-white rounded-lg border overflow-hidden">
                    <div className="overflow-x-auto">
                      <table className="min-w-full divide-y divide-gray-200">
                        <thead className="bg-gray-50">
                          <tr>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                              문제 정보
                            </th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                              난이도/분야
                            </th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                              공개 상태
                            </th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                              사용 횟수
                            </th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                              등록일
                            </th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                              관리
                            </th>
                          </tr>
                        </thead>
                        <tbody className="bg-white divide-y divide-gray-200">
                          {problems.map((problem) => (
                            <tr key={problem.id} className="hover:bg-gray-50">
                              <td className="px-6 py-4 whitespace-nowrap">
                                <div>
                                  <div className="text-sm font-medium text-gray-900">
                                    {problem.title}
                                  </div>
                                  <div className="text-sm text-gray-500">
                                    ID: {problem.id}
                                  </div>
                                </div>
                              </td>
                              <td className="px-6 py-4 whitespace-nowrap">
                                <div className="flex items-center space-x-2">
                                  <span className={`px-2 py-1 text-xs rounded ${getDifficultyColor(problem.difficulty_level)}`}>
                                    난이도 {problem.difficulty_level}
                                  </span>
                                  <span className="px-2 py-1 bg-gray-100 text-gray-700 text-xs rounded">
                                    {problem.subject_area}
                                  </span>
                                </div>
                              </td>
                              <td className="px-6 py-4 whitespace-nowrap">
                                <button
                                  onClick={() => toggleProblemVisibility(problem.id, problem.status === 'published')}
                                  className={`relative inline-flex items-center h-6 rounded-full w-11 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 transition-colors ${
                                    problem.status === 'published' ? 'bg-green-600' : 'bg-gray-200'
                                  }`}
                                >
                                  <span
                                    className={`inline-block w-4 h-4 transform bg-white rounded-full transition-transform ${
                                      problem.status === 'published' ? 'translate-x-6' : 'translate-x-1'
                                    }`}
                                  />
                                </button>
                                <div className="text-xs text-gray-500 mt-1">
                                  {problem.status === 'published' ? '공개' : problem.status === 'draft' ? '초안' : '보관'}
                                </div>
                              </td>
                              <td className="px-6 py-4 whitespace-nowrap">
                                <span className="text-sm font-medium text-gray-900">
                                  {problem.usage_count}회
                                </span>
                              </td>
                              <td className="px-6 py-4 whitespace-nowrap">
                                <span className="text-sm text-gray-500">
                                  {formatDate(problem.created_at)}
                                </span>
                              </td>
                              <td className="px-6 py-4 whitespace-nowrap text-sm font-medium space-x-2">
                                <button
                                  onClick={() => window.location.href = `/teacher/problems/${problem.id}`}
                                  className="text-blue-600 hover:text-blue-900"
                                >
                                  보기
                                </button>
                                <button
                                  onClick={() => window.location.href = `/teacher/problems/${problem.id}/edit`}
                                  className="text-gray-600 hover:text-gray-900"
                                >
                                  수정
                                </button>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        {/* 하단 도움말 */}
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
          <h4 className="font-medium text-blue-800 mb-2">도움말</h4>
          <div className="text-sm text-blue-700 space-y-1">
            <p>• <strong>대시보드 개요</strong>: 오늘의 수업 현황과 전체 통계를 확인할 수 있습니다</p>
            <p>• <strong>문제 관리</strong>: 등록한 문제의 공개/비공개 상태를 관리하고 사용 통계를 확인할 수 있습니다</p>
            <p>• 공개된 문제만 학생들이 선택할 수 있으며, 비공개 문제는 목록에 표시되지 않습니다</p>
          </div>
        </div>
      </div>
    </div>
  )
}