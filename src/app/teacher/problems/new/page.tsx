'use client'

import { useState } from 'react'
import { toast } from 'react-hot-toast'
import Link from 'next/link'

export default function NewProblemPage() {
  const [formData, setFormData] = useState({
    title: '',
    content: '',
    preview_lead_time: 10, // 기본값 10분 (사전열람 시간)
    available_date: '', // 문제 공개 날짜
    is_public: false
  })
  const [loading, setLoading] = useState(false)
  const [images, setImages] = useState<Array<{
    url: string
    fileName: string
    altText: string
  }>>([])
  const [uploading, setUploading] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)

    try {
      const problemData = {
        ...formData,
        images: images
      }

      const response = await fetch('/api/teacher/problems', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',  // 쿠키 포함
        body: JSON.stringify(problemData),
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
        setImages([...images, {
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
    const image = images[index]
    try {
      const response = await fetch(`/api/upload/images?fileName=${image.fileName}`, {
        method: 'DELETE',
        credentials: 'include'
      })

      const data = await response.json()

      if (data.success) {
        setImages(images.filter((_, i) => i !== index))
        toast.success('이미지가 삭제되었습니다!')
      } else {
        toast.error(data.error || '이미지 삭제에 실패했습니다.')
      }
    } catch (error) {
      console.error('이미지 삭제 오류:', error)
      toast.error('이미지 삭제 중 오류가 발생했습니다.')
    }
  }

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    const { name, value, type } = e.target
    setFormData({
      ...formData,
      [name]: type === 'checkbox' ? (e.target as HTMLInputElement).checked : 
               type === 'number' || name === 'preview_lead_time' ? parseInt(value) || 0 : value
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
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
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
                <label htmlFor="preview_lead_time" className="block text-sm font-medium text-gray-700 mb-1">
                  사전열람 시간 *
                </label>
                <div className="relative">
                  <input
                    type="number"
                    id="preview_lead_time"
                    name="preview_lead_time"
                    value={formData.preview_lead_time}
                    onChange={handleInputChange}
                    required
                    min="1"
                    max="60"
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="10"
                  />
                  <div className="absolute inset-y-0 right-0 pr-3 flex items-center pointer-events-none">
                    <span className="text-gray-500 text-sm">분</span>
                  </div>
                </div>
                <p className="mt-1 text-xs text-gray-500">면접 시작 전 문제를 볼 수 있는 시간 (1~60분)</p>
              </div>

              <div>
                <label htmlFor="available_date" className="block text-sm font-medium text-gray-700 mb-1">
                  공개 날짜 *
                </label>
                <input
                  type="date"
                  id="available_date"
                  name="available_date"
                  value={formData.available_date}
                  onChange={handleInputChange}
                  required
                  min={new Date().toISOString().split('T')[0]} // 오늘 이후만 선택 가능
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
                <p className="mt-1 text-xs text-gray-500">학생들이 문제를 선택할 수 있는 날짜</p>
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
                  등록 즉시 활성화
                </label>
              </div>
            </div>

            {/* 문제 내용 */}
            <div>
              <label htmlFor="content" className="block text-sm font-medium text-gray-700 mb-1">
                문제 내용 *
              </label>
              <textarea
                id="content"
                name="content"
                value={formData.content}
                onChange={handleInputChange}
                required
                rows={8}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="문제의 내용을 자세히 작성하세요..."
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
                    id="imageUpload"
                    accept="image/jpeg,image/png,image/gif,image/webp"
                    onChange={handleImageUpload}
                    className="hidden"
                  />
                  <label
                    htmlFor="imageUpload"
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
                {images.length > 0 && (
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {images.map((image, index) => (
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
            <p>• 사전열람 시간은 면접 시작 전에 학생이 문제를 미리 볼 수 있는 시간입니다</p>
            <p>• 공개 날짜는 학생들이 해당 문제를 선택할 수 있는 날짜입니다</p>
            <p>• 문제 내용에는 필요한 조건과 요구사항을 명확히 기술하세요</p>
            <p>• 이미지는 문제 이해를 돕는 도식, 그래프, 표 등을 첨부할 때 사용하세요</p>
            <p>• &lsquo;등록 즉시 활성화&rsquo;를 체크하면 등록과 동시에 학생들이 선택할 수 있게 됩니다</p>
            <p>• 체크하지 않으면 초안 상태로 저장되어 나중에 수동으로 활성화할 수 있습니다</p>
          </div>
        </div>
      </div>
    </div>
  )
}