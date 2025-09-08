'use client'

import { useState } from 'react'
import { toast } from 'react-hot-toast'
import Link from 'next/link'

export default function NewProblemPage() {
  const [formData, setFormData] = useState({
    title: '',
    subject_area: '대수',
    difficulty_level: 1,
    description: '',
    solution: '',
    hints: '',
    is_public: false
  })
  const [loading, setLoading] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)

    try {
      const response = await fetch('/api/teacher/problems', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',  // 쿠키 포함
        body: JSON.stringify(formData),
      })

      const data = await response.json()

      if (data.success) {
        toast.success('문제가 성공적으로 등록되었습니다!')
        window.location.href = '/dashboard/teacher'
      } else {
        toast.error(data.error || '문제 등록에 실패했습니다.')
      }
    } catch (error) {
      console.error('문제 등록 오류:', error)
      toast.error('문제 등록 중 오류가 발생했습니다.')
    } finally {
      setLoading(false)
    }
  }

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    const { name, value, type } = e.target
    setFormData({
      ...formData,
      [name]: type === 'checkbox' ? (e.target as HTMLInputElement).checked : 
               type === 'number' ? parseInt(value) : value
    })
  }

  return (
    <div className="min-h-screen bg-gray-100">
      <div className="container mx-auto px-4 py-8">
        {/* 헤더 */}
        <div className="bg-white rounded-lg shadow-md p-6 mb-6">
          <div className="flex justify-between items-center">
            <div>
              <div className="flex items-center space-x-2 mb-2">
                <Link 
                  href="/dashboard/teacher"
                  className="text-blue-600 hover:text-blue-800"
                >
                  ← 대시보드
                </Link>
              </div>
              <h1 className="text-2xl font-bold text-gray-800">
                새 문제 등록
              </h1>
              <p className="text-gray-600">학생들에게 제공할 새로운 문제를 등록합니다</p>
            </div>
          </div>
        </div>

        {/* 문제 등록 폼 */}
        <div className="bg-white rounded-lg shadow-md p-6">
          <form onSubmit={handleSubmit} className="space-y-6">
            {/* 기본 정보 */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <label htmlFor="title" className="block text-sm font-medium text-gray-700 mb-1">
                  문제 제목 *
                </label>
                <input
                  type="text"
                  id="title"
                  name="title"
                  value={formData.title}
                  onChange={handleInputChange}
                  required
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="예: 이차방정식의 해 구하기"
                />
              </div>

              <div>
                <label htmlFor="subject_area" className="block text-sm font-medium text-gray-700 mb-1">
                  수학 영역 *
                </label>
                <select
                  id="subject_area"
                  name="subject_area"
                  value={formData.subject_area}
                  onChange={handleInputChange}
                  required
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="대수">대수</option>
                  <option value="기하">기하</option>
                  <option value="함수">함수</option>
                  <option value="확률과 통계">확률과 통계</option>
                  <option value="미적분">미적분</option>
                  <option value="수열">수열</option>
                  <option value="벡터">벡터</option>
                  <option value="기타">기타</option>
                </select>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <label htmlFor="difficulty_level" className="block text-sm font-medium text-gray-700 mb-1">
                  난이도 *
                </label>
                <select
                  id="difficulty_level"
                  name="difficulty_level"
                  value={formData.difficulty_level}
                  onChange={handleInputChange}
                  required
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value={1}>1단계 (기초)</option>
                  <option value={2}>2단계 (쉬움)</option>
                  <option value={3}>3단계 (보통)</option>
                  <option value={4}>4단계 (어려움)</option>
                  <option value={5}>5단계 (매우 어려움)</option>
                </select>
              </div>

              <div className="flex items-center">
                <input
                  type="checkbox"
                  id="is_public"
                  name="is_public"
                  checked={formData.is_public}
                  onChange={handleInputChange}
                  className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                />
                <label htmlFor="is_public" className="ml-2 block text-sm text-gray-900">
                  등록 즉시 학생들에게 공개
                </label>
              </div>
            </div>

            {/* 문제 설명 */}
            <div>
              <label htmlFor="description" className="block text-sm font-medium text-gray-700 mb-1">
                문제 설명 *
              </label>
              <textarea
                id="description"
                name="description"
                value={formData.description}
                onChange={handleInputChange}
                required
                rows={8}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="문제의 내용을 자세히 작성하세요..."
              />
            </div>

            {/* 해답 */}
            <div>
              <label htmlFor="solution" className="block text-sm font-medium text-gray-700 mb-1">
                해답 및 풀이 *
              </label>
              <textarea
                id="solution"
                name="solution"
                value={formData.solution}
                onChange={handleInputChange}
                required
                rows={6}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="정답과 단계별 풀이 과정을 작성하세요..."
              />
            </div>

            {/* 힌트 */}
            <div>
              <label htmlFor="hints" className="block text-sm font-medium text-gray-700 mb-1">
                힌트 (선택사항)
              </label>
              <textarea
                id="hints"
                name="hints"
                value={formData.hints}
                onChange={handleInputChange}
                rows={4}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="학생들에게 도움이 될 힌트를 작성하세요..."
              />
            </div>

            {/* 버튼 */}
            <div className="flex justify-between pt-6 border-t">
              <Link
                href="/dashboard/teacher"
                className="px-6 py-3 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 transition-colors"
              >
                취소
              </Link>
              <button
                type="submit"
                disabled={loading}
                className={`px-6 py-3 rounded-lg text-white font-medium transition-colors ${
                  loading
                    ? 'bg-gray-400 cursor-not-allowed'
                    : 'bg-blue-600 hover:bg-blue-700'
                }`}
              >
                {loading ? '등록 중...' : '문제 등록'}
              </button>
            </div>
          </form>
        </div>

        {/* 도움말 */}
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mt-6">
          <h4 className="font-medium text-blue-800 mb-2">문제 등록 가이드</h4>
          <div className="text-sm text-blue-700 space-y-1">
            <p>• 문제 제목은 간결하고 명확하게 작성하세요</p>
            <p>• 난이도는 학생 수준을 고려하여 적절히 설정하세요</p>
            <p>• 문제 설명에는 필요한 조건과 요구사항을 명확히 기술하세요</p>
            <p>• 해답에는 단계별 풀이 과정을 포함하여 학생들이 이해하기 쉽게 작성하세요</p>
          </div>
        </div>
      </div>
    </div>
  )
}