'use client'

import { useState, useEffect } from 'react'
import { toast } from 'react-hot-toast'
import Link from 'next/link'

interface Problem {
  id: number
  title: string
  subject_area: string
  difficulty_level: number
  description: string
  solution: string
  hints: string | null
  status: 'draft' | 'published' | 'archived'
  usage_count: number
  created_at: string
  updated_at: string
}

interface Props {
  params: Promise<{
    id: string
  }>
}

export default function ProblemDetailPage({ params }: Props) {
  const [problem, setProblem] = useState<Problem | null>(null)
  const [loading, setLoading] = useState(true)
  const [problemId, setProblemId] = useState<string>('')

  useEffect(() => {
    async function loadParams() {
      const resolvedParams = await params
      setProblemId(resolvedParams.id)
    }
    loadParams()
  }, [params])

  useEffect(() => {
    if (!problemId) return
    fetchProblem()
  }, [problemId])

  const fetchProblem = async () => {
    try {
      const response = await fetch(`/api/teacher/problems/${problemId}`, {
        credentials: 'include'  // 쿠키 포함
      })
      const data = await response.json()

      if (data.success) {
        setProblem(data.problem)
      } else {
        toast.error('문제를 불러올 수 없습니다.')
        window.location.href = '/dashboard/teacher'
      }
    } catch (error) {
      console.error('문제 조회 실패:', error)
      toast.error('문제 조회 중 오류가 발생했습니다.')
    } finally {
      setLoading(false)
    }
  }

  const togglePublicStatus = async () => {
    if (!problem) return

    try {
      const response = await fetch(`/api/teacher/problems/${problem.id}/publish`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',  // 쿠키 포함
        body: JSON.stringify({}),
      })

      const data = await response.json()

      if (data.success) {
        setProblem({
          ...problem,
          status: problem.status === 'published' ? 'draft' : 'published'
        })
        toast.success(problem.status === 'published' ? '문제가 비공개로 변경되었습니다.' : '문제가 공개되었습니다.')
      } else {
        toast.error(data.error || '상태 변경에 실패했습니다.')
      }
    } catch (error) {
      console.error('공개 상태 변경 실패:', error)
      toast.error('오류가 발생했습니다.')
    }
  }

  const getDifficultyColor = (level: number) => {
    if (level <= 2) return 'bg-green-100 text-green-700'
    if (level <= 3) return 'bg-yellow-100 text-yellow-700'
    return 'bg-red-100 text-red-700'
  }

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('ko-KR', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: 'numeric',
      minute: 'numeric'
    })
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-100 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-blue-500 mx-auto"></div>
          <p className="mt-4 text-gray-600">문제를 불러오는 중...</p>
        </div>
      </div>
    )
  }

  if (!problem) {
    return (
      <div className="min-h-screen bg-gray-100 flex items-center justify-center">
        <div className="text-center">
          <h2 className="text-2xl font-bold text-gray-800 mb-4">문제를 찾을 수 없습니다</h2>
          <Link
            href="/dashboard/teacher"
            className="px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600"
          >
            대시보드로 돌아가기
          </Link>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-100">
      <div className="container mx-auto px-4 py-8">
        {/* 헤더 */}
        <div className="bg-white rounded-lg shadow-md p-6 mb-6">
          <div className="flex justify-between items-start">
            <div>
              <div className="flex items-center space-x-2 mb-2">
                <Link 
                  href="/dashboard/teacher"
                  className="text-blue-600 hover:text-blue-800"
                >
                  ← 대시보드
                </Link>
              </div>
              <h1 className="text-2xl font-bold text-gray-800 mb-2">
                {problem.title}
              </h1>
              <div className="flex items-center space-x-3">
                <span className="px-2 py-1 bg-gray-100 text-gray-700 text-sm rounded">
                  {problem.subject_area}
                </span>
                <span className={`px-2 py-1 text-sm rounded ${getDifficultyColor(problem.difficulty_level)}`}>
                  난이도 {problem.difficulty_level}
                </span>
                <span className={`px-2 py-1 text-sm rounded ${
                  problem.status === 'published'
                    ? 'bg-green-100 text-green-700' 
                    : problem.status === 'draft'
                    ? 'bg-orange-100 text-orange-700'
                    : 'bg-gray-100 text-gray-700'
                }`}>
                  {problem.status === 'published' ? '공개' : problem.status === 'draft' ? '카안' : '보관'}
                </span>
              </div>
            </div>
            <div className="flex space-x-3">
              <button
                onClick={togglePublicStatus}
                className={`px-4 py-2 rounded-lg text-white transition-colors ${
                  problem.status === 'published'
                    ? 'bg-orange-500 hover:bg-orange-600'
                    : 'bg-green-500 hover:bg-green-600'
                }`}
              >
                {problem.status === 'published' ? '비공개로 변경' : '공개하기'}
              </button>
            </div>
          </div>
        </div>

        {/* 문제 통계 */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
          <div className="bg-white rounded-lg shadow-md p-4">
            <h3 className="text-sm font-medium text-gray-600 mb-1">사용 횟수</h3>
            <p className="text-2xl font-bold text-blue-600">{problem.usage_count}회</p>
          </div>
          <div className="bg-white rounded-lg shadow-md p-4">
            <h3 className="text-sm font-medium text-gray-600 mb-1">등록일</h3>
            <p className="text-sm text-gray-800">{formatDate(problem.created_at)}</p>
          </div>
          <div className="bg-white rounded-lg shadow-md p-4">
            <h3 className="text-sm font-medium text-gray-600 mb-1">수정일</h3>
            <p className="text-sm text-gray-800">{formatDate(problem.updated_at)}</p>
          </div>
        </div>

        {/* 문제 내용 */}
        <div className="space-y-6">
          {/* 문제 설명 */}
          <div className="bg-white rounded-lg shadow-md p-6">
            <h3 className="text-lg font-semibold text-gray-800 mb-4">문제 설명</h3>
            <div className="bg-gray-50 rounded-lg p-4">
              <pre className="whitespace-pre-wrap text-gray-800 leading-relaxed">
                {problem.description}
              </pre>
            </div>
          </div>

          {/* 해답 */}
          <div className="bg-white rounded-lg shadow-md p-6">
            <h3 className="text-lg font-semibold text-gray-800 mb-4">해답 및 풀이</h3>
            <div className="bg-blue-50 rounded-lg p-4">
              <pre className="whitespace-pre-wrap text-gray-800 leading-relaxed">
                {problem.solution}
              </pre>
            </div>
          </div>

          {/* 힌트 */}
          {problem.hints && (
            <div className="bg-white rounded-lg shadow-md p-6">
              <h3 className="text-lg font-semibold text-gray-800 mb-4">힌트</h3>
              <div className="bg-yellow-50 rounded-lg p-4">
                <pre className="whitespace-pre-wrap text-gray-800 leading-relaxed">
                  {problem.hints}
                </pre>
              </div>
            </div>
          )}
        </div>

        {/* 액션 버튼 */}
        <div className="mt-6 flex justify-center space-x-4">
          <Link
            href="/dashboard/teacher"
            className="px-6 py-3 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 transition-colors"
          >
            목록으로 돌아가기
          </Link>
        </div>
      </div>
    </div>
  )
}