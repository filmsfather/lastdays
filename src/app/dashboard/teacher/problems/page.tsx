'use client'

import { useState, useEffect, useMemo } from 'react'
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
  
  // DataTable states
  const [searchTerm, setSearchTerm] = useState('')
  const [sortConfig, setSortConfig] = useState<{key: string, direction: 'asc' | 'desc'}>({key: 'available_date', direction: 'desc'})
  const [statusFilter, setStatusFilter] = useState('all')
  const [currentPage, setCurrentPage] = useState(1)
  const [itemsPerPage, setItemsPerPage] = useState(10)

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
        setProblems(data.problems)
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

  // 정렬 함수
  const handleSort = (key: string) => {
    let direction: 'asc' | 'desc' = 'asc'
    if (sortConfig.key === key && sortConfig.direction === 'asc') {
      direction = 'desc'
    }
    setSortConfig({ key, direction })
    setCurrentPage(1) // 정렬 시 첫 페이지로 이동
  }

  // 검색, 필터링, 정렬된 문제 목록
  const filteredAndSortedProblems = useMemo(() => {
    let filtered = problems

    // 검색 필터링
    if (searchTerm) {
      filtered = filtered.filter(problem => 
        problem.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (problem.creator?.name || '').toLowerCase().includes(searchTerm.toLowerCase())
      )
    }

    // 상태 필터링
    if (statusFilter !== 'all') {
      filtered = filtered.filter(problem => problem.status === statusFilter)
    }

    // 정렬
    if (sortConfig.key) {
      filtered = [...filtered].sort((a, b) => {
        let aValue: any = a[sortConfig.key as keyof Problem]
        let bValue: any = b[sortConfig.key as keyof Problem]

        // 특별한 정렬 처리
        if (sortConfig.key === 'creator') {
          aValue = a.creator?.name || ''
          bValue = b.creator?.name || ''
        } else if (sortConfig.key === 'available_date' || sortConfig.key === 'created_at') {
          aValue = new Date(aValue).getTime()
          bValue = new Date(bValue).getTime()
        }

        if (aValue < bValue) {
          return sortConfig.direction === 'asc' ? -1 : 1
        }
        if (aValue > bValue) {
          return sortConfig.direction === 'asc' ? 1 : -1
        }
        return 0
      })
    }

    return filtered
  }, [problems, searchTerm, statusFilter, sortConfig])

  // 페이지네이션
  const totalPages = Math.ceil(filteredAndSortedProblems.length / itemsPerPage)
  const startIndex = (currentPage - 1) * itemsPerPage
  const paginatedProblems = filteredAndSortedProblems.slice(startIndex, startIndex + itemsPerPage)

  // 페이지 변경
  const handlePageChange = (page: number) => {
    setCurrentPage(page)
  }

  // 페이지당 항목 수 변경
  const handleItemsPerPageChange = (items: number) => {
    setItemsPerPage(items)
    setCurrentPage(1)
  }

  // 정렬 아이콘 렌더링
  const getSortIcon = (columnKey: string) => {
    if (sortConfig.key !== columnKey) {
      return <span className="text-gray-400 ml-1">↕️</span>
    }
    return sortConfig.direction === 'asc' ? 
      <span className="text-blue-600 ml-1">↑</span> : 
      <span className="text-blue-600 ml-1">↓</span>
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
              <p className="text-gray-600">
                총 {filteredAndSortedProblems.length}개 문제 
                {searchTerm || statusFilter !== 'all' ? ` (${problems.length}개 중 필터링됨)` : ''}
              </p>
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

          {/* 검색 및 필터 컨트롤 */}
          <div className="mb-6 space-y-4">
            <div className="flex flex-col md:flex-row gap-4">
              {/* 검색창 */}
              <div className="flex-1">
                <div className="relative">
                  <input
                    type="text"
                    placeholder="문제 제목 또는 작성자명으로 검색..."
                    value={searchTerm}
                    onChange={(e) => {
                      setSearchTerm(e.target.value)
                      setCurrentPage(1)
                    }}
                    className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center">
                    <svg className="h-5 w-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                    </svg>
                  </div>
                  {searchTerm && (
                    <button
                      onClick={() => {
                        setSearchTerm('')
                        setCurrentPage(1)
                      }}
                      className="absolute inset-y-0 right-0 pr-3 flex items-center"
                    >
                      <svg className="h-5 w-5 text-gray-400 hover:text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    </button>
                  )}
                </div>
              </div>

              {/* 상태 필터 */}
              <div className="flex gap-4">
                <select
                  value={statusFilter}
                  onChange={(e) => {
                    setStatusFilter(e.target.value)
                    setCurrentPage(1)
                  }}
                  className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white"
                >
                  <option value="all">모든 상태</option>
                  <option value="published">활성</option>
                  <option value="draft">비활성</option>
                  <option value="archived">보관</option>
                </select>

                {/* 페이지당 항목 수 */}
                <select
                  value={itemsPerPage}
                  onChange={(e) => handleItemsPerPageChange(Number(e.target.value))}
                  className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white"
                >
                  <option value={5}>5개씩</option>
                  <option value={10}>10개씩</option>
                  <option value={25}>25개씩</option>
                  <option value={50}>50개씩</option>
                </select>
              </div>
            </div>

            {/* 필터 상태 표시 */}
            {(searchTerm || statusFilter !== 'all') && (
              <div className="flex flex-wrap gap-2">
                {searchTerm && (
                  <span className="inline-flex items-center px-3 py-1 rounded-full text-sm bg-blue-100 text-blue-800">
                    검색: &quot;{searchTerm}&quot;
                    <button
                      onClick={() => {
                        setSearchTerm('')
                        setCurrentPage(1)
                      }}
                      className="ml-2 text-blue-600 hover:text-blue-800"
                    >
                      ×
                    </button>
                  </span>
                )}
                {statusFilter !== 'all' && (
                  <span className="inline-flex items-center px-3 py-1 rounded-full text-sm bg-green-100 text-green-800">
                    상태: {statusFilter === 'published' ? '활성' : statusFilter === 'draft' ? '비활성' : '보관'}
                    <button
                      onClick={() => {
                        setStatusFilter('all')
                        setCurrentPage(1)
                      }}
                      className="ml-2 text-green-600 hover:text-green-800"
                    >
                      ×
                    </button>
                  </span>
                )}
                <button
                  onClick={() => {
                    setSearchTerm('')
                    setStatusFilter('all')
                    setCurrentPage(1)
                  }}
                  className="text-sm text-gray-500 hover:text-gray-700 underline"
                >
                  모든 필터 지우기
                </button>
              </div>
            )}
          </div>

          {/* 문제 목록 */}
          {filteredAndSortedProblems.length === 0 ? (
            <div className="bg-white border rounded-lg p-8 text-center">
              <div className="text-gray-400 mb-4">
                <svg className="mx-auto h-12 w-12" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M14,2H6A2,2 0 0,0 4,4V20A2,2 0 0,0 6,22H18A2,2 0 0,0 20,20V8L14,2M18,20H6V4H13V9H18V20Z" />
                </svg>
              </div>
              <h4 className="text-lg font-medium text-gray-600 mb-2">
                {problems.length === 0 ? '등록된 문제가 없습니다' : '검색 결과가 없습니다'}
              </h4>
              <p className="text-gray-500 mb-4">
                {problems.length === 0 
                  ? '새로운 문제를 등록해서 학생들에게 제공해보세요'
                  : '다른 검색어나 필터를 사용해보세요'
                }
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
                      <th 
                        className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100 transition-colors"
                        onClick={() => handleSort('title')}
                      >
                        <div className="flex items-center">
                          문제 정보
                          {getSortIcon('title')}
                        </div>
                      </th>
                      <th 
                        className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100 transition-colors"
                        onClick={() => handleSort('creator')}
                      >
                        <div className="flex items-center">
                          작성자
                          {getSortIcon('creator')}
                        </div>
                      </th>
                      <th 
                        className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100 transition-colors"
                        onClick={() => handleSort('available_date')}
                      >
                        <div className="flex items-center">
                          공개 날짜
                          {getSortIcon('available_date')}
                        </div>
                      </th>
                      <th 
                        className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100 transition-colors"
                        onClick={() => handleSort('preview_lead_time')}
                      >
                        <div className="flex items-center">
                          사전열람
                          {getSortIcon('preview_lead_time')}
                        </div>
                      </th>
                      <th 
                        className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100 transition-colors"
                        onClick={() => handleSort('status')}
                      >
                        <div className="flex items-center">
                          활성 상태
                          {getSortIcon('status')}
                        </div>
                      </th>
                      <th 
                        className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100 transition-colors"
                        onClick={() => handleSort('created_at')}
                      >
                        <div className="flex items-center">
                          등록일
                          {getSortIcon('created_at')}
                        </div>
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        관리
                      </th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {paginatedProblems.map((problem) => (
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
              
              {/* 페이지네이션 */}
              {totalPages > 1 && (
                <div className="bg-white px-4 py-3 flex items-center justify-between border-t border-gray-200 sm:px-6">
                  <div className="flex-1 flex justify-between sm:hidden">
                    <button
                      onClick={() => handlePageChange(currentPage - 1)}
                      disabled={currentPage === 1}
                      className="relative inline-flex items-center px-4 py-2 border border-gray-300 text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      이전
                    </button>
                    <button
                      onClick={() => handlePageChange(currentPage + 1)}
                      disabled={currentPage === totalPages}
                      className="ml-3 relative inline-flex items-center px-4 py-2 border border-gray-300 text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      다음
                    </button>
                  </div>
                  <div className="hidden sm:flex-1 sm:flex sm:items-center sm:justify-between">
                    <div>
                      <p className="text-sm text-gray-700">
                        <span className="font-medium">{startIndex + 1}</span>
                        -
                        <span className="font-medium">{Math.min(startIndex + itemsPerPage, filteredAndSortedProblems.length)}</span>
                        of
                        <span className="font-medium"> {filteredAndSortedProblems.length}</span>
                        개 결과
                      </p>
                    </div>
                    <div>
                      <nav className="relative z-0 inline-flex rounded-md shadow-sm -space-x-px" aria-label="Pagination">
                        <button
                          onClick={() => handlePageChange(currentPage - 1)}
                          disabled={currentPage === 1}
                          className="relative inline-flex items-center px-2 py-2 rounded-l-md border border-gray-300 bg-white text-sm font-medium text-gray-500 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                          <span className="sr-only">Previous</span>
                          <svg className="h-5 w-5" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
                            <path fillRule="evenodd" d="M12.707 5.293a1 1 0 010 1.414L9.414 10l3.293 3.293a1 1 0 01-1.414 1.414l-4-4a1 1 0 010-1.414l4-4a1 1 0 011.414 0z" clipRule="evenodd" />
                          </svg>
                        </button>
                        
                        {/* 페이지 번호들 */}
                        {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                          let pageNum;
                          if (totalPages <= 5) {
                            pageNum = i + 1;
                          } else if (currentPage <= 3) {
                            pageNum = i + 1;
                          } else if (currentPage >= totalPages - 2) {
                            pageNum = totalPages - 4 + i;
                          } else {
                            pageNum = currentPage - 2 + i;
                          }
                          
                          return (
                            <button
                              key={pageNum}
                              onClick={() => handlePageChange(pageNum)}
                              className={`relative inline-flex items-center px-4 py-2 border text-sm font-medium ${
                                currentPage === pageNum
                                  ? 'z-10 bg-blue-50 border-blue-500 text-blue-600'
                                  : 'bg-white border-gray-300 text-gray-500 hover:bg-gray-50'
                              }`}
                            >
                              {pageNum}
                            </button>
                          );
                        })}
                        
                        <button
                          onClick={() => handlePageChange(currentPage + 1)}
                          disabled={currentPage === totalPages}
                          className="relative inline-flex items-center px-2 py-2 rounded-r-md border border-gray-300 bg-white text-sm font-medium text-gray-500 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                          <span className="sr-only">Next</span>
                          <svg className="h-5 w-5" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
                            <path fillRule="evenodd" d="M7.293 14.707a1 1 0 010-1.414L10.586 10 7.293 6.707a1 1 0 011.414-1.414l4 4a1 1 0 010 1.414l-4 4a1 1 0 01-1.414 0z" clipRule="evenodd" />
                          </svg>
                        </button>
                      </nav>
                    </div>
                  </div>
                </div>
              )}
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