'use client'

import { useState, useEffect } from 'react'
import { getCurrentUser } from '@/lib/auth'

interface User {
  id: number
  name: string
  className: string
  role: 'student' | 'teacher' | 'admin'
}

interface ImageData {
  url: string
  fileName: string
  altText: string
  size: number
  type: string
}

interface Problem {
  id: number
  title: string
  content: string
  images: ImageData[]
  difficulty_level: number
  subject_area: string
  status: string
}

export default function TestImagesPage() {
  const [user, setUser] = useState<User | null>(null)
  const [problems, setProblems] = useState<Problem[]>([])
  const [selectedProblemId, setSelectedProblemId] = useState<string>('')
  const [uploadedImages, setUploadedImages] = useState<ImageData[]>([])
  const [loading, setLoading] = useState<boolean>(false)
  const [error, setError] = useState<string>('')

  // 새 문제 폼 상태
  const [newProblem, setNewProblem] = useState({
    title: '',
    content: '',
    difficulty_level: 1,
    subject_area: '',
    images: [] as ImageData[]
  })

  useEffect(() => {
    const loadUser = async () => {
      try {
        const response = await fetch('/api/auth/me')
        if (response.ok) {
          const data = await response.json()
          setUser(data.user)
          if (data.user.role === 'teacher') {
            loadProblems()
          }
        }
      } catch (error) {
        console.error('Failed to load user:', error)
      }
    }
    loadUser()
  }, [])

  // 교사의 문제 목록 조회
  const loadProblems = async () => {
    try {
      const response = await fetch('/api/teacher/problems')
      if (response.ok) {
        const data = await response.json()
        setProblems(data.problems)
      }
    } catch (error) {
      console.error('Failed to load problems:', error)
    }
  }

  // 이미지 업로드
  const handleImageUpload = async (file: File) => {
    setLoading(true)
    setError('')

    const formData = new FormData()
    formData.append('file', file)
    formData.append('problemId', selectedProblemId)
    formData.append('altText', `${file.name} 이미지`)

    try {
      const response = await fetch('/api/upload/images', {
        method: 'POST',
        body: formData
      })

      const data = await response.json()
      if (data.success) {
        const newImage: ImageData = {
          url: data.data.url,
          fileName: data.data.fileName,
          altText: data.data.altText,
          size: data.data.size,
          type: data.data.type
        }
        setUploadedImages([...uploadedImages, newImage])
        setNewProblem({
          ...newProblem,
          images: [...newProblem.images, newImage]
        })
      } else {
        setError(data.error || '이미지 업로드에 실패했습니다.')
      }
    } catch (error) {
      setError('서버 오류가 발생했습니다.')
    } finally {
      setLoading(false)
    }
  }

  // 이미지 삭제
  const handleImageDelete = async (fileName: string) => {
    try {
      const response = await fetch(`/api/upload/images?fileName=${fileName}`, {
        method: 'DELETE'
      })

      const data = await response.json()
      if (data.success) {
        setUploadedImages(uploadedImages.filter(img => img.fileName !== fileName))
        setNewProblem({
          ...newProblem,
          images: newProblem.images.filter(img => img.fileName !== fileName)
        })
      } else {
        setError(data.error || '이미지 삭제에 실패했습니다.')
      }
    } catch (error) {
      setError('서버 오류가 발생했습니다.')
    }
  }

  // 새 문제 생성
  const createProblem = async () => {
    if (!newProblem.title || !newProblem.content) {
      setError('제목과 내용을 입력해주세요.')
      return
    }

    try {
      const response = await fetch('/api/teacher/problems', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newProblem)
      })

      const data = await response.json()
      if (data.success) {
        alert('문제가 생성되었습니다!')
        setNewProblem({
          title: '',
          content: '',
          difficulty_level: 1,
          subject_area: '',
          images: []
        })
        setUploadedImages([])
        loadProblems()
      } else {
        setError(data.error || '문제 생성에 실패했습니다.')
      }
    } catch (error) {
      setError('서버 오류가 발생했습니다.')
    }
  }

  // 드래그 앤 드롭 핸들러
  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault()
  }

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault()
    const files = Array.from(e.dataTransfer.files)
    files.forEach(file => {
      if (file.type.startsWith('image/')) {
        handleImageUpload(file)
      }
    })
  }

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || [])
    files.forEach(file => {
      if (file.type.startsWith('image/')) {
        handleImageUpload(file)
      }
    })
  }

  if (!user) {
    return <div className="p-4">로그인이 필요합니다.</div>
  }

  if (user.role !== 'teacher') {
    return <div className="p-4">교사만 접근할 수 있습니다.</div>
  }

  return (
    <div className="max-w-6xl mx-auto p-4">
      <h1 className="text-2xl font-bold mb-6">이미지 업로드 테스트 페이지</h1>
      
      <div className="mb-6 p-4 bg-gray-50 rounded">
        <p><strong>현재 사용자:</strong> {user.name} ({user.className}) - {user.role}</p>
      </div>

      {error && (
        <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded text-red-700">
          {error}
        </div>
      )}

      {/* 기존 문제 목록 */}
      <div className="mb-8">
        <h2 className="text-xl font-semibold mb-4">기존 문제 목록</h2>
        <div className="grid gap-4">
          {problems.map((problem) => (
            <div key={problem.id} className="p-4 border rounded">
              <h3 className="font-semibold">{problem.title}</h3>
              <p className="text-gray-600 text-sm">{problem.subject_area} - 난이도 {problem.difficulty_level}</p>
              <p className="mt-2">{problem.content.substring(0, 100)}...</p>
              
              {problem.images && problem.images.length > 0 && (
                <div className="mt-4">
                  <h4 className="font-medium mb-2">첨부된 이미지 ({problem.images.length}개):</h4>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    {problem.images.map((image: any, idx) => (
                      <div key={idx} className="relative">
                        <img 
                          src={image.url} 
                          alt={image.altText || `문제 이미지 ${idx + 1}`}
                          className="w-full h-32 object-cover rounded border"
                        />
                        <div className="mt-1 text-xs text-gray-600">
                          {image.altText || `이미지 ${idx + 1}`}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* 새 문제 생성 폼 */}
      <div className="mb-8 p-6 border rounded bg-blue-50">
        <h2 className="text-xl font-semibold mb-4">새 문제 생성 (이미지 포함)</h2>
        
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium mb-2">문제 제목</label>
            <input
              type="text"
              value={newProblem.title}
              onChange={(e) => setNewProblem({...newProblem, title: e.target.value})}
              className="w-full border px-3 py-2 rounded"
              placeholder="문제 제목을 입력하세요"
            />
          </div>

          <div>
            <label className="block text-sm font-medium mb-2">문제 내용</label>
            <textarea
              value={newProblem.content}
              onChange={(e) => setNewProblem({...newProblem, content: e.target.value})}
              className="w-full border px-3 py-2 rounded h-32 resize-none"
              placeholder="문제 내용을 입력하세요"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium mb-2">난이도 (1-5)</label>
              <input
                type="number"
                min="1"
                max="5"
                value={newProblem.difficulty_level}
                onChange={(e) => setNewProblem({...newProblem, difficulty_level: parseInt(e.target.value)})}
                className="w-full border px-3 py-2 rounded"
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-2">과목 영역</label>
              <input
                type="text"
                value={newProblem.subject_area}
                onChange={(e) => setNewProblem({...newProblem, subject_area: e.target.value})}
                className="w-full border px-3 py-2 rounded"
                placeholder="예: 대수학, 기하학 등"
              />
            </div>
          </div>
        </div>
      </div>

      {/* 이미지 업로드 영역 */}
      <div className="mb-8 p-6 border-2 border-dashed border-gray-300 rounded bg-gray-50">
        <h3 className="text-lg font-semibold mb-4">이미지 업로드</h3>
        
        <div
          onDragOver={handleDragOver}
          onDrop={handleDrop}
          className="text-center py-12 bg-white border-2 border-dashed border-gray-300 rounded"
        >
          <div className="text-gray-500">
            <p className="text-lg mb-2">이미지를 여기에 드래그하거나</p>
            <label className="inline-block bg-blue-500 text-white px-4 py-2 rounded cursor-pointer hover:bg-blue-600">
              파일 선택
              <input
                type="file"
                multiple
                accept="image/*"
                onChange={handleFileSelect}
                className="hidden"
              />
            </label>
          </div>
          <p className="text-sm text-gray-400 mt-2">
            JPEG, PNG, GIF, WebP 형식만 지원 (최대 5MB)
          </p>
        </div>

        {loading && (
          <div className="mt-4 text-center">
            <div className="inline-block animate-spin rounded-full h-6 w-6 border-b-2 border-blue-500"></div>
            <p className="text-sm text-gray-600 mt-2">업로드 중...</p>
          </div>
        )}
      </div>

      {/* 업로드된 이미지 미리보기 */}
      {uploadedImages.length > 0 && (
        <div className="mb-8">
          <h3 className="text-lg font-semibold mb-4">업로드된 이미지 ({uploadedImages.length}개)</h3>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {uploadedImages.map((image, idx) => (
              <div key={idx} className="relative border rounded overflow-hidden">
                <img 
                  src={image.url} 
                  alt={image.altText}
                  className="w-full h-32 object-cover"
                />
                <div className="p-2 bg-white">
                  <p className="text-xs text-gray-600 truncate">{image.altText}</p>
                  <p className="text-xs text-gray-400">
                    {Math.round(image.size / 1024)}KB - {image.type}
                  </p>
                </div>
                <button
                  onClick={() => handleImageDelete(image.fileName)}
                  className="absolute top-2 right-2 bg-red-500 text-white w-6 h-6 rounded-full text-xs hover:bg-red-600"
                >
                  ×
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 문제 생성 버튼 */}
      <div className="text-center">
        <button
          onClick={createProblem}
          className="bg-green-500 text-white px-8 py-3 rounded-lg text-lg hover:bg-green-600 disabled:opacity-50"
          disabled={loading || !newProblem.title || !newProblem.content}
        >
          이미지와 함께 문제 생성
        </button>
      </div>

      {/* Supabase Storage 설정 안내 */}
      <div className="mt-12 p-4 bg-yellow-50 border border-yellow-200 rounded">
        <h3 className="font-semibold text-yellow-800 mb-2">⚠️ Supabase Storage 설정 필요</h3>
        <p className="text-yellow-700 text-sm">
          이미지 업로드가 작동하려면 Supabase 프로젝트에서 다음 설정이 필요합니다:
        </p>
        <ol className="list-decimal list-inside text-yellow-700 text-sm mt-2 space-y-1">
          <li><strong>Storage 버킷 생성:</strong> &apos;problem-images&apos; 버킷을 생성하세요</li>
          <li><strong>공개 정책 설정:</strong> 버킷을 공개로 설정하거나 적절한 RLS 정책을 추가하세요</li>
          <li><strong>업로드 권한:</strong> 교사가 업로드할 수 있도록 정책을 설정하세요</li>
        </ol>
      </div>
    </div>
  )
}