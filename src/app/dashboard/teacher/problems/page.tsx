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
  limit_minutes: number
  available_date: string
  preview_lead_time: number
  status: 'draft' | 'published' | 'archived'
  created_at: string
  updated_at: string
  creator?: {
    name: string
  }
}

export default function ProblemsManagementPage() {
  const [user, setUser] = useState<User | null>(null)
  const [problems, setProblems] = useState<Problem[]>([])
  const [loading, setLoading] = useState(true)

  // 현재 사용자 정보 조회
  useEffect(() => {
    async function fetchCurrentUser() {
      try {
        const response = await fetch('/api/auth/me', {
          credentials: 'include'
        })
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

  // 문제 목록 조회
  useEffect(() => {
    if (!user) return

    async function loadProblems() {
      setLoading(true)
      try {
        await fetchProblems()
      } catch (error) {
        console.error('데이터 로드 실패:', error)
        toast.error('데이터를 불러오는 중 오류가 발생했습니다.')
      } finally {
        setLoading(false)
      }
    }

    loadProblems()
  }, [user])

  // 문제 목록 조회
  const fetchProblems = async () => {
    try {
      const response = await fetch('/api/teacher/problems', {
        credentials: 'include'  // 쿠키 포함
      })
      const data = await response.json()
      
      if (data.success) {
        // 공개날짜 기준으로 내림차순 정렬 (최신이 위, 오래된 것이 아래)
        const sortedProblems = data.problems.sort((a: Problem, b: Problem) => {
          return new Date(b.available_date).getTime() - new Date(a.available_date).getTime()
        })
        setProblems(sortedProblems)
      }
    } catch (error) {
      console.error('문제 조회 실패:', error)
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
      } else {
        toast.error(data.error || '상태 변경에 실패했습니다.')
      }
    } catch (error) {
      console.error('문제 상태 변경 실패:', error)
      toast.error('오류가 발생했습니다.')
    }
  }

  // 날짜 포맷팅 (YYYY-MM-DD 형식을 MM/DD로 표시)
  const formatAvailableDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('ko-KR', {
      month: 'numeric',
      day: 'numeric'
    })
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
                문제 관리
              </h1>
              <p className="text-gray-600">{user?.name} 선생님 • {user?.class_name}</p>
            </div>
            <div className="flex space-x-4">
              <Link 
                href="/dashboard/teacher"
                className="px-4 py-2 bg-gray-500 text-white rounded-lg hover:bg-gray-600 transition-colors"
              >
                대시보드
              </Link>
              <Link 
                href="/dashboard/teacher/today"
                className="px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors"
              >
                오늘 스케줄
              </Link>
              <Link 
                href="/dashboard/teacher/schedule"
                className="px-4 py-2 bg-purple-500 text-white rounded-lg hover:bg-purple-600 transition-colors"
              >
                내 스케줄 관리
              </Link>
              <Link 
                href="/dashboard/teacher/students"
                className="px-4 py-2 bg-green-500 text-white rounded-lg hover:bg-green-600 transition-colors"
              >
                학생 관리
              </Link>
              <Link 
                href="/dashboard/teacher/reservations"
                className="px-4 py-2 bg-orange-500 text-white rounded-lg hover:bg-orange-600 transition-colors"
              >
                예약 현황
              </Link>
              <Link 
                href="/dashboard/teacher/board"
                className="px-4 py-2 bg-indigo-500 text-white rounded-lg hover:bg-indigo-600 transition-colors"
              >
                선생님 게시판
              </Link>
            </div>
          </div>
        </div>

        {/* 문제 관리 메인 컨텐츠 */}
        <div className="bg-white rounded-lg shadow-md p-6">
          {/* 문제 관리 헤더 */}
          <div className="flex justify-between items-center mb-6">
            <div>
              <h3 className="text-lg font-semibold text-gray-800">문제 목록</h3>
              <p className="text-gray-600">등록한 문제들을 관리할 수 있습니다</p>
            </div>
            <div className="space-x-3">
              <Link
                href="/teacher/problems/new"
                className="px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors inline-block"
              >
                새 문제 등록
              </Link>
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
              <Link
                href="/teacher/problems/new"
                className="px-6 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors inline-block"
              >
                첫 문제 등록하기
              </Link>
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
                        작성자
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        공개 날짜
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        사전열람
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        활성 상태
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
                          <span className="text-sm font-medium text-blue-600">
                            {problem.creator?.name || '알 수 없음'}
                          </span>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <span className="text-sm text-gray-500">
                            {formatAvailableDate(problem.available_date)}
                          </span>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <span className="text-sm text-gray-500">
                            {problem.preview_lead_time}분 전
                          </span>
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
                            {problem.status === 'published' ? '활성' : problem.status === 'draft' ? '비활성' : '보관'}
                          </div>
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
                            onClick={() => window.location.href = `/teacher/problems/${problem.id}`}
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

        {/* 하단 도움말 */}
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mt-6">
          <h4 className="font-medium text-blue-800 mb-2">도움말</h4>
          <div className="text-sm text-blue-700 space-y-1">
            <p>• <strong>문제 관리</strong>: 등록한 문제의 활성/비활성 상태를 관리하고 제한시간, 공개날짜, 사전열람시간을 확인할 수 있습니다</p>
            <p>• 활성 상태의 문제만 학생들이 선택할 수 있으며, 비활성 문제는 목록에 표시되지 않습니다</p>
            <p>• 문제를 클릭하면 상세 정보를 확인하거나 수정할 수 있습니다</p>
          </div>
        </div>
      </div>
    </div>
  )
}