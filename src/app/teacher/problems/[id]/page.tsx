'use client'

import { useState, useEffect } from 'react'
import { toast } from 'react-hot-toast'
import Link from 'next/link'

interface Problem {
  id: number
  title: string
  content: string
  limit_minutes: number
  available_date: string
  status: 'draft' | 'published' | 'archived'
  images?: Array<{
    url: string
    fileName: string
    altText: string
  }>
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
  const [isEditing, setIsEditing] = useState(false)
  const [editData, setEditData] = useState({
    title: '',
    content: '',
    limit_minutes: 60,
    available_date: ''
  })
  const [saving, setSaving] = useState(false)
  const [editImages, setEditImages] = useState<Array<{
    url: string
    fileName: string
    altText: string
  }>>([])
  const [uploading, setUploading] = useState(false)

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
        // 편집 데이터 초기화
        setEditData({
          title: data.problem.title,
          content: data.problem.content,
          limit_minutes: data.problem.limit_minutes,
          available_date: data.problem.available_date
        })
        // 이미지 데이터 초기화
        if (data.problem.images) {
          setEditImages(data.problem.images)
        }
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
        toast.success(problem.status === 'published' ? '문제가 비활성화되었습니다.' : '문제가 활성화되었습니다.')
      } else {
        toast.error(data.error || '상태 변경에 실패했습니다.')
      }
    } catch (error) {
      console.error('공개 상태 변경 실패:', error)
      toast.error('오류가 발생했습니다.')
    }
  }

  const startEditing = () => {
    if (!problem) return
    setEditData({
      title: problem.title,
      content: problem.content,
      limit_minutes: problem.limit_minutes,
      available_date: problem.available_date
    })
    if (problem.images) {
      setEditImages(problem.images)
    }
    setIsEditing(true)
  }

  const cancelEditing = () => {
    setIsEditing(false)
    if (!problem) return
    setEditData({
      title: problem.title,
      content: problem.content,
      limit_minutes: problem.limit_minutes,
      available_date: problem.available_date
    })
    if (problem.images) {
      setEditImages(problem.images)
    }
  }

  const saveChanges = async () => {
    if (!problem) return

    setSaving(true)
    try {
      const response = await fetch(`/api/teacher/problems/${problem.id}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify({
          title: editData.title,
          content: editData.content,
          limit_minutes: editData.limit_minutes,
          available_date: editData.available_date,
          images: editImages
        }),
      })

      const data = await response.json()

      if (data.success) {
        setProblem({
          ...problem,
          ...editData,
          images: editImages,
          updated_at: new Date().toISOString()
        })
        setIsEditing(false)
        toast.success('문제가 성공적으로 수정되었습니다!')
      } else {
        toast.error(data.error || '문제 수정에 실패했습니다.')
      }
    } catch (error) {
      console.error('문제 수정 오류:', error)
      toast.error('문제 수정 중 오류가 발생했습니다.')
    } finally {
      setSaving(false)
    }
  }

  const handleEditInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target
    setEditData({
      ...editData,
      [name]: name === 'limit_minutes' ? parseInt(value) || 0 : value
    })
  }

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    setUploading(true)
    try {
      const formData = new FormData()
      formData.append('file', file)
      formData.append('altText', '문제 이미지')

      const response = await fetch('/api/upload/images', {
        method: 'POST',
        body: formData,
        credentials: 'include'
      })

      const data = await response.json()

      if (data.success) {
        setEditImages([...editImages, {
          url: data.data.url,
          fileName: data.data.fileName,
          altText: data.data.altText
        }])
        toast.success('이미지가 업로드되었습니다!')
      } else {
        toast.error(data.error || '이미지 업로드에 실패했습니다.')
      }
    } catch (error) {
      console.error('이미지 업로드 오류:', error)
      toast.error('이미지 업로드 중 오류가 발생했습니다.')
    } finally {
      setUploading(false)
      // 파일 input 초기화
      e.target.value = ''
    }
  }

  const handleImageDelete = async (index: number) => {
    const image = editImages[index]
    try {
      const response = await fetch(`/api/upload/images?fileName=${image.fileName}`, {
        method: 'DELETE',
        credentials: 'include'
      })

      const data = await response.json()

      if (data.success) {
        setEditImages(editImages.filter((_, i) => i !== index))
        toast.success('이미지가 삭제되었습니다!')
      } else {
        toast.error(data.error || '이미지 삭제에 실패했습니다.')
      }
    } catch (error) {
      console.error('이미지 삭제 오류:', error)
      toast.error('이미지 삭제 중 오류가 발생했습니다.')
    }
  }

  const formatTimeLimit = (minutes: number) => {
    if (minutes < 60) {
      return `${minutes}분`
    } else {
      const hours = Math.floor(minutes / 60)
      const remainingMinutes = minutes % 60
      return remainingMinutes > 0 ? `${hours}시간 ${remainingMinutes}분` : `${hours}시간`
    }
  }

  const formatAvailableDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('ko-KR', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      weekday: 'long'
    })
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
                <span className="px-2 py-1 bg-blue-100 text-blue-700 text-sm rounded">
                  제한시간: {formatTimeLimit(problem.limit_minutes)}
                </span>
                <span className="px-2 py-1 bg-purple-100 text-purple-700 text-sm rounded">
                  공개일: {formatAvailableDate(problem.available_date)}
                </span>
                <span className={`px-2 py-1 text-sm rounded ${
                  problem.status === 'published'
                    ? 'bg-green-100 text-green-700' 
                    : problem.status === 'draft'
                    ? 'bg-orange-100 text-orange-700'
                    : 'bg-gray-100 text-gray-700'
                }`}>
                  {problem.status === 'published' ? '활성화' : problem.status === 'draft' ? '초안' : '보관'}
                </span>
              </div>
            </div>
            <div className="flex space-x-3">
              {!isEditing ? (
                <>
                  <button
                    onClick={startEditing}
                    className="px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors"
                  >
                    수정
                  </button>
                  <button
                    onClick={togglePublicStatus}
                    className={`px-4 py-2 rounded-lg text-white transition-colors ${
                      problem.status === 'published'
                        ? 'bg-orange-500 hover:bg-orange-600'
                        : 'bg-green-500 hover:bg-green-600'
                    }`}
                  >
                    {problem.status === 'published' ? '비활성화' : '활성화'}
                  </button>
                </>
              ) : (
                <>
                  <button
                    onClick={saveChanges}
                    disabled={saving}
                    className={`px-4 py-2 rounded-lg text-white transition-colors ${
                      saving
                        ? 'bg-gray-400 cursor-not-allowed'
                        : 'bg-green-500 hover:bg-green-600'
                    }`}
                  >
                    {saving ? '저장 중...' : '저장'}
                  </button>
                  <button
                    onClick={cancelEditing}
                    disabled={saving}
                    className="px-4 py-2 bg-gray-500 text-white rounded-lg hover:bg-gray-600 transition-colors disabled:opacity-50"
                  >
                    취소
                  </button>
                </>
              )}
            </div>
          </div>
        </div>

        {/* 문제 정보 */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
          <div className="bg-white rounded-lg shadow-md p-4">
            <h3 className="text-sm font-medium text-gray-600 mb-1">제한시간</h3>
            <p className="text-lg font-bold text-blue-600">{formatTimeLimit(problem.limit_minutes)}</p>
          </div>
          <div className="bg-white rounded-lg shadow-md p-4">
            <h3 className="text-sm font-medium text-gray-600 mb-1">공개 날짜</h3>
            <p className="text-sm text-gray-800">{formatAvailableDate(problem.available_date)}</p>
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
          {/* 편집 가능한 문제 정보 */}
          {isEditing ? (
            <div className="bg-white rounded-lg shadow-md p-6">
              <h3 className="text-lg font-semibold text-gray-800 mb-4">문제 수정</h3>
              <div className="space-y-4">
                {/* 제목 수정 */}
                <div>
                  <label htmlFor="edit-title" className="block text-sm font-medium text-gray-700 mb-1">
                    문제 제목 *
                  </label>
                  <input
                    type="text"
                    id="edit-title"
                    name="title"
                    value={editData.title}
                    onChange={handleEditInputChange}
                    required
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>

                {/* 제한시간 및 공개날짜 수정 */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label htmlFor="edit-limit-minutes" className="block text-sm font-medium text-gray-700 mb-1">
                      제한시간 *
                    </label>
                    <div className="relative">
                      <input
                        type="number"
                        id="edit-limit-minutes"
                        name="limit_minutes"
                        value={editData.limit_minutes}
                        onChange={handleEditInputChange}
                        required
                        min="1"
                        max="300"
                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                      />
                      <div className="absolute inset-y-0 right-0 pr-3 flex items-center pointer-events-none">
                        <span className="text-gray-500 text-sm">분</span>
                      </div>
                    </div>
                  </div>
                  <div>
                    <label htmlFor="edit-available-date" className="block text-sm font-medium text-gray-700 mb-1">
                      공개 날짜 *
                    </label>
                    <input
                      type="date"
                      id="edit-available-date"
                      name="available_date"
                      value={editData.available_date}
                      onChange={handleEditInputChange}
                      required
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                </div>

                {/* 내용 수정 */}
                <div>
                  <label htmlFor="edit-content" className="block text-sm font-medium text-gray-700 mb-1">
                    문제 내용 *
                  </label>
                  <textarea
                    id="edit-content"
                    name="content"
                    value={editData.content}
                    onChange={handleEditInputChange}
                    required
                    rows={8}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>

                {/* 이미지 업로드 */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-3">
                    문제 이미지 (선택사항)
                  </label>
                  
                  <div className="space-y-4">
                    {/* 이미지 업로드 버튼 */}
                    <div className="flex items-center gap-4">
                      <input
                        type="file"
                        id="editImageUpload"
                        accept="image/jpeg,image/png,image/gif,image/webp"
                        onChange={handleImageUpload}
                        className="hidden"
                      />
                      <label
                        htmlFor="editImageUpload"
                        className={`px-4 py-2 border border-dashed border-gray-300 rounded-lg cursor-pointer hover:bg-gray-50 transition-colors flex items-center gap-2 ${
                          uploading ? 'opacity-50 cursor-not-allowed' : ''
                        }`}
                      >
                        <svg className="w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                        </svg>
                        {uploading ? '업로드 중...' : '이미지 추가'}
                      </label>
                      <span className="text-sm text-gray-500">
                        JPEG, PNG, GIF, WebP (최대 5MB)
                      </span>
                    </div>

                    {/* 업로드된 이미지 목록 */}
                    {editImages.length > 0 && (
                      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                        {editImages.map((image, index) => (
                          <div key={index} className="relative border border-gray-200 rounded-lg overflow-hidden">
                            <img
                              src={image.url}
                              alt={image.altText}
                              className="w-full h-48 object-cover"
                            />
                            <div className="absolute top-2 right-2">
                              <button
                                type="button"
                                onClick={() => handleImageDelete(index)}
                                className="bg-red-500 text-white rounded-full p-1 hover:bg-red-600 transition-colors"
                                title="이미지 삭제"
                              >
                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                                </svg>
                              </button>
                            </div>
                            <div className="p-2 bg-gray-50">
                              <p className="text-xs text-gray-600 truncate">{image.fileName}</p>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>
          ) : (
            /* 문제 내용 표시 */
            <div className="bg-white rounded-lg shadow-md p-6">
              <h3 className="text-lg font-semibold text-gray-800 mb-4">문제 내용</h3>
              <div className="bg-gray-50 rounded-lg p-4">
                <pre className="whitespace-pre-wrap text-gray-800 leading-relaxed">
                  {problem.content}
                </pre>
              </div>
            </div>
          )}

          {/* 문제 이미지 */}
          {problem.images && problem.images.length > 0 && (
            <div className="bg-white rounded-lg shadow-md p-6">
              <h3 className="text-lg font-semibold text-gray-800 mb-4">문제 이미지</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {problem.images.map((image, index) => (
                  <div key={index} className="border border-gray-200 rounded-lg overflow-hidden">
                    <img
                      src={image.url}
                      alt={image.altText}
                      className="w-full h-48 object-cover"
                    />
                    <div className="p-2 bg-gray-50">
                      <p className="text-xs text-gray-600 truncate">{image.fileName}</p>
                    </div>
                  </div>
                ))}
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