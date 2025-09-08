'use client'

import { useState } from 'react'
import { toast } from 'react-hot-toast'
import Link from 'next/link'

export default function LoginPage() {
  const [formData, setFormData] = useState({
    name: '',
    pin: ''
  })
  const [loading, setLoading] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)

    try {
      const response = await fetch('/api/auth/login', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(formData),
      })

      const data = await response.json()

      if (data.success) {
        toast.success('로그인 성공!')
        
        // 역할에 따라 대시보드로 리다이렉트
        if (data.user.role === 'admin') {
          window.location.href = '/dashboard/admin'
        } else if (data.user.role === 'teacher') {
          window.location.href = '/dashboard/teacher'
        } else if (data.user.role === 'student') {
          window.location.href = '/dashboard/student'
        } else {
          window.location.href = '/'
        }
      } else {
        toast.error(data.error || '로그인에 실패했습니다.')
      }
    } catch (error) {
      console.error('로그인 오류:', error)
      toast.error('로그인 중 오류가 발생했습니다.')
    } finally {
      setLoading(false)
    }
  }

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value
    })
  }

  return (
    <div className="min-h-screen gradient-bg flex items-center justify-center px-6">
      <div className="w-full max-w-md animate-fade-in">
        {/* Header */}
        <div className="text-center mb-8">
          <Link href="/" className="inline-flex items-center space-x-2 mb-6">
            <div className="w-10 h-10 bg-blue-600 rounded-xl flex items-center justify-center">
              <span className="text-white font-bold">L</span>
            </div>
            <span className="text-2xl font-bold text-gray-900">Last Days</span>
          </Link>
        </div>

        {/* Login Card */}
        <div className="card animate-slide-up">
          <div className="text-center mb-8">
            <h1 className="text-3xl font-bold text-gray-900 mb-2">
              환영합니다
            </h1>
            <p className="text-muted">
              계정 정보를 입력하여 로그인하세요
            </p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-6">
            <div>
              <label htmlFor="name" className="label">
                이름
              </label>
              <input
                type="text"
                id="name"
                name="name"
                value={formData.name}
                onChange={handleInputChange}
                required
                className="input"
                placeholder="이름을 입력하세요"
              />
            </div>

            <div>
              <label htmlFor="pin" className="label">
                PIN 코드
              </label>
              <input
                type="password"
                id="pin"
                name="pin"
                value={formData.pin}
                onChange={handleInputChange}
                required
                className="input"
                placeholder="PIN 코드를 입력하세요"
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              className={`w-full py-3 px-4 rounded-xl text-white font-semibold transition-all duration-200 ${
                loading
                  ? 'bg-gray-400 cursor-not-allowed'
                  : 'bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-4 focus:ring-blue-100 shadow-soft hover:shadow-medium transform hover:-translate-y-0.5'
              }`}
            >
              {loading ? (
                <div className="flex items-center justify-center space-x-2">
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                  <span>로그인 중...</span>
                </div>
              ) : (
                '로그인'
              )}
            </button>
          </form>

          {/* Test Accounts */}
          <div className="mt-8 pt-6 border-t border-gray-200">
            <div className="text-center">
              <p className="text-sm font-medium text-gray-700 mb-4">테스트 계정</p>
              <div className="grid grid-cols-1 gap-3">
                <div className="bg-gray-50 rounded-xl p-3">
                  <div className="flex justify-between items-center text-sm">
                    <span className="font-medium text-gray-700">관리자</span>
                    <span className="text-gray-500">관리자 / 1234</span>
                  </div>
                </div>
                <div className="bg-gray-50 rounded-xl p-3">
                  <div className="flex justify-between items-center text-sm">
                    <span className="font-medium text-gray-700">교사</span>
                    <span className="text-gray-500">김선생 / 5678</span>
                  </div>
                </div>
                <div className="bg-gray-50 rounded-xl p-3">
                  <div className="flex justify-between items-center text-sm">
                    <span className="font-medium text-gray-700">학생</span>
                    <span className="text-gray-500">김학생 / 9999</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="text-center mt-8">
          <p className="text-sm text-gray-500">
            문제가 있으시면 관리자에게 문의하세요
          </p>
          <Link 
            href="/"
            className="inline-flex items-center text-sm text-blue-600 hover:text-blue-700 font-medium mt-2"
          >
            <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
            </svg>
            홈으로 돌아가기
          </Link>
        </div>
      </div>
    </div>
  )
}