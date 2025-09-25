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

interface BoardPost {
  id: number
  title: string
  content: string
  is_anonymous: boolean
  author_id: number
  author_name?: string
  author_class_name?: string
  view_count: number
  comment_count?: number
  created_at: string
  updated_at: string
}

interface BoardComment {
  id: number
  post_id: number
  content: string
  is_anonymous: boolean
  author_id: number
  author_name?: string
  author_class_name?: string
  created_at: string
}

export default function TeacherBoardPage() {
  const [user, setUser] = useState<User | null>(null)
  const [posts, setPosts] = useState<BoardPost[]>([])
  const [comments, setComments] = useState<BoardComment[]>([])
  const [loading, setLoading] = useState(true)
  
  // 화면 상태 관리
  const [view, setView] = useState<'list' | 'write' | 'detail'>('list')
  const [selectedPost, setSelectedPost] = useState<BoardPost | null>(null)
  
  // 폼 상태 관리
  const [postTitle, setPostTitle] = useState('')
  const [postContent, setPostContent] = useState('')
  const [isAnonymous, setIsAnonymous] = useState(false)
  const [commentContent, setCommentContent] = useState('')
  const [commentAnonymous, setCommentAnonymous] = useState(false)

  // 익명 이름 생성 함수
  const getDisplayName = (authorId: number, authorName: string, authorClassName: string, anonymous: boolean) => {
    return anonymous 
      ? `익명 #${authorId.toString().padStart(3, '0')}`
      : `${authorName} 선생님 • ${authorClassName}`
  }

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

  // 게시글 목록 조회
  useEffect(() => {
    if (user && view === 'list') {
      fetchPosts()
    }
  }, [user, view])

  // 게시글 상세 조회 시 댓글도 함께 조회
  useEffect(() => {
    if (selectedPost && view === 'detail') {
      fetchComments(selectedPost.id)
    }
  }, [selectedPost, view])

  const fetchPosts = async () => {
    try {
      setLoading(true)
      const response = await fetch('/api/teacher/board/posts', {
        credentials: 'include'
      })
      const data = await response.json()
      
      if (data.success) {
        setPosts(data.posts || [])
      } else {
        toast.error('게시글을 불러오는데 실패했습니다.')
      }
    } catch (error) {
      console.error('게시글 조회 실패:', error)
      toast.error('게시글을 불러오는데 실패했습니다.')
    } finally {
      setLoading(false)
    }
  }

  const fetchComments = async (postId: number) => {
    try {
      const response = await fetch(`/api/teacher/board/posts/${postId}/comments`, {
        credentials: 'include'
      })
      const data = await response.json()
      
      if (data.success) {
        setComments(data.comments || [])
      }
    } catch (error) {
      console.error('댓글 조회 실패:', error)
    }
  }

  const handleSubmitPost = async (e: React.FormEvent) => {
    e.preventDefault()
    
    if (!postTitle.trim() || !postContent.trim()) {
      toast.error('제목과 내용을 모두 입력해주세요.')
      return
    }

    try {
      const response = await fetch('/api/teacher/board/posts', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify({
          title: postTitle.trim(),
          content: postContent.trim(),
          is_anonymous: isAnonymous
        }),
      })

      const data = await response.json()

      if (data.success) {
        toast.success('게시글이 작성되었습니다.')
        setPostTitle('')
        setPostContent('')
        setIsAnonymous(false)
        setView('list')
        fetchPosts()
      } else {
        toast.error(data.error || '게시글 작성에 실패했습니다.')
      }
    } catch (error) {
      console.error('게시글 작성 실패:', error)
      toast.error('게시글 작성 중 오류가 발생했습니다.')
    }
  }

  const handleSubmitComment = async (e: React.FormEvent) => {
    e.preventDefault()
    
    if (!commentContent.trim()) {
      toast.error('댓글 내용을 입력해주세요.')
      return
    }

    if (!selectedPost) return

    try {
      const response = await fetch('/api/teacher/board/comments', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify({
          post_id: selectedPost.id,
          content: commentContent.trim(),
          is_anonymous: commentAnonymous
        }),
      })

      const data = await response.json()

      if (data.success) {
        toast.success('댓글이 작성되었습니다.')
        setCommentContent('')
        setCommentAnonymous(false)
        fetchComments(selectedPost.id)
      } else {
        toast.error(data.error || '댓글 작성에 실패했습니다.')
      }
    } catch (error) {
      console.error('댓글 작성 실패:', error)
      toast.error('댓글 작성 중 오류가 발생했습니다.')
    }
  }

  const handlePostClick = async (post: BoardPost) => {
    // 조회수 증가
    try {
      await fetch(`/api/teacher/board/posts/${post.id}/view`, {
        method: 'POST',
        credentials: 'include'
      })
    } catch (error) {
      console.error('조회수 업데이트 실패:', error)
    }
    
    setSelectedPost(post)
    setView('detail')
  }

  // 날짜 포맷팅
  const formatDate = (dateString: string) => {
    const date = new Date(dateString)
    const now = new Date()
    const diffMs = now.getTime() - date.getTime()
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24))
    
    if (diffDays === 0) {
      return date.toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' })
    } else if (diffDays < 7) {
      return `${diffDays}일 전`
    } else {
      return date.toLocaleDateString('ko-KR', { month: 'short', day: 'numeric' })
    }
  }

  if (!user) {
    return (
      <div className="min-h-screen bg-gray-100 flex items-center justify-center">
        <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-blue-500"></div>
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
              <h1 className="text-2xl font-bold text-gray-800 flex items-center">
                💬 선생님 게시판
              </h1>
              <p className="text-gray-600">선생님들의 소통 공간</p>
            </div>
            <div className="flex space-x-4">
              <Link 
                href="/dashboard/teacher"
                className="px-4 py-2 bg-gray-500 text-white rounded-lg hover:bg-gray-600 transition-colors"
              >
                대시보드로
              </Link>
              {view === 'list' && (
                <button
                  onClick={() => setView('write')}
                  className="px-4 py-2 bg-indigo-500 text-white rounded-lg hover:bg-indigo-600 transition-colors"
                >
                  글쓰기
                </button>
              )}
              {view !== 'list' && (
                <button
                  onClick={() => {
                    setView('list')
                    setSelectedPost(null)
                    setPostTitle('')
                    setPostContent('')
                    setIsAnonymous(false)
                  }}
                  className="px-4 py-2 bg-gray-500 text-white rounded-lg hover:bg-gray-600 transition-colors"
                >
                  목록으로
                </button>
              )}
            </div>
          </div>
        </div>

        {/* 게시글 목록 */}
        {view === 'list' && (
          <div className="bg-white rounded-lg shadow-md">
            <div className="p-6 border-b border-gray-200">
              <h3 className="text-lg font-semibold text-gray-800">게시글 목록</h3>
              <p className="text-gray-600">총 {posts.length}개의 게시글</p>
            </div>
            
            {loading ? (
              <div className="p-8 text-center">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-500 mx-auto"></div>
                <p className="mt-2 text-gray-600">로딩 중...</p>
              </div>
            ) : posts.length === 0 ? (
              <div className="p-8 text-center">
                <div className="text-gray-400 mb-4">
                  <svg className="mx-auto h-12 w-12" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M19 3H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zm-5 14H7v-2h7v2zm3-4H7v-2h10v2zm0-4H7V7h10v2z"/>
                  </svg>
                </div>
                <h4 className="text-lg font-medium text-gray-600 mb-2">
                  첫 번째 게시글을 작성해보세요
                </h4>
                <p className="text-gray-500 mb-4">
                  선생님들과 소중한 이야기를 나눠보세요
                </p>
                <button
                  onClick={() => setView('write')}
                  className="px-6 py-2 bg-indigo-500 text-white rounded-lg hover:bg-indigo-600 transition-colors"
                >
                  첫 게시글 작성하기
                </button>
              </div>
            ) : (
              <div className="divide-y divide-gray-200">
                {posts.map((post) => (
                  <div 
                    key={post.id}
                    onClick={() => handlePostClick(post)}
                    className="p-6 hover:bg-gray-50 cursor-pointer transition-colors"
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <h4 className="text-lg font-medium text-gray-900 mb-2">
                          {post.title}
                        </h4>
                        <p className="text-gray-600 mb-3 line-clamp-2">
                          {post.content.length > 100 
                            ? `${post.content.substring(0, 100)}...` 
                            : post.content}
                        </p>
                        <div className="flex items-center space-x-4 text-sm text-gray-500">
                          <span>
                            {getDisplayName(
                              post.author_id, 
                              post.author_name || '', 
                              post.author_class_name || '', 
                              post.is_anonymous
                            )}
                          </span>
                          <span>{formatDate(post.created_at)}</span>
                          <span className="flex items-center">
                            👀 {post.view_count}
                          </span>
                          <span className="flex items-center">
                            💬 {post.comment_count || 0}
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* 게시글 작성 폼 */}
        {view === 'write' && (
          <div className="bg-white rounded-lg shadow-md p-6">
            <h3 className="text-lg font-semibold text-gray-800 mb-6">새 게시글 작성</h3>
            
            <form onSubmit={handleSubmitPost} className="space-y-6">
              {/* 익명/실명 선택 */}
              <div className="flex items-center space-x-4">
                <label className="text-sm font-medium text-gray-700">작성 방식:</label>
                <label className="flex items-center">
                  <input
                    type="radio"
                    name="anonymous"
                    checked={!isAnonymous}
                    onChange={() => setIsAnonymous(false)}
                    className="mr-2"
                  />
                  <span className="text-sm">실명 ({user.name} 선생님 • {user.class_name})</span>
                </label>
                <label className="flex items-center">
                  <input
                    type="radio"
                    name="anonymous"
                    checked={isAnonymous}
                    onChange={() => setIsAnonymous(true)}
                    className="mr-2"
                  />
                  <span className="text-sm">익명 (익명 #{user.id.toString().padStart(3, '0')})</span>
                </label>
              </div>

              {/* 제목 입력 */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  제목
                </label>
                <input
                  type="text"
                  value={postTitle}
                  onChange={(e) => setPostTitle(e.target.value)}
                  placeholder="게시글 제목을 입력하세요"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                  maxLength={200}
                />
              </div>

              {/* 내용 입력 */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  내용
                </label>
                <textarea
                  value={postContent}
                  onChange={(e) => setPostContent(e.target.value)}
                  placeholder="게시글 내용을 입력하세요"
                  rows={10}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                />
              </div>

              {/* 작성 버튼 */}
              <div className="flex justify-end space-x-4">
                <button
                  type="button"
                  onClick={() => {
                    setView('list')
                    setPostTitle('')
                    setPostContent('')
                    setIsAnonymous(false)
                  }}
                  className="px-6 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 transition-colors"
                >
                  취소
                </button>
                <button
                  type="submit"
                  className="px-6 py-2 bg-indigo-500 text-white rounded-lg hover:bg-indigo-600 transition-colors"
                >
                  게시글 작성
                </button>
              </div>
            </form>
          </div>
        )}

        {/* 게시글 상세보기 */}
        {view === 'detail' && selectedPost && (
          <div className="space-y-6">
            {/* 게시글 내용 */}
            <div className="bg-white rounded-lg shadow-md p-6">
              <div className="mb-4">
                <h2 className="text-2xl font-bold text-gray-900 mb-2">
                  {selectedPost.title}
                </h2>
                <div className="flex items-center space-x-4 text-sm text-gray-500">
                  <span>
                    {getDisplayName(
                      selectedPost.author_id,
                      selectedPost.author_name || '',
                      selectedPost.author_class_name || '',
                      selectedPost.is_anonymous
                    )}
                  </span>
                  <span>{formatDate(selectedPost.created_at)}</span>
                  <span className="flex items-center">
                    👀 {selectedPost.view_count}
                  </span>
                </div>
              </div>
              
              <div className="prose max-w-none">
                <div className="text-gray-800 whitespace-pre-wrap leading-relaxed">
                  {selectedPost.content}
                </div>
              </div>
            </div>

            {/* 댓글 섹션 */}
            <div className="bg-white rounded-lg shadow-md p-6">
              <h3 className="text-lg font-semibold text-gray-800 mb-4">
                댓글 {comments.length}개
              </h3>

              {/* 댓글 작성 폼 */}
              <form onSubmit={handleSubmitComment} className="mb-6 p-4 bg-gray-50 rounded-lg">
                <div className="flex items-center space-x-4 mb-3">
                  <label className="text-sm font-medium text-gray-700">댓글 작성:</label>
                  <label className="flex items-center">
                    <input
                      type="radio"
                      name="commentAnonymous"
                      checked={!commentAnonymous}
                      onChange={() => setCommentAnonymous(false)}
                      className="mr-2"
                    />
                    <span className="text-sm">실명</span>
                  </label>
                  <label className="flex items-center">
                    <input
                      type="radio"
                      name="commentAnonymous"
                      checked={commentAnonymous}
                      onChange={() => setCommentAnonymous(true)}
                      className="mr-2"
                    />
                    <span className="text-sm">익명</span>
                  </label>
                </div>
                
                <textarea
                  value={commentContent}
                  onChange={(e) => setCommentContent(e.target.value)}
                  placeholder="댓글을 입력하세요"
                  rows={3}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 mb-3"
                />
                
                <div className="flex justify-end">
                  <button
                    type="submit"
                    className="px-4 py-2 bg-indigo-500 text-white rounded-lg hover:bg-indigo-600 transition-colors"
                  >
                    댓글 작성
                  </button>
                </div>
              </form>

              {/* 댓글 목록 */}
              <div className="space-y-4">
                {comments.length === 0 ? (
                  <p className="text-gray-500 text-center py-4">
                    아직 댓글이 없습니다. 첫 댓글을 작성해보세요!
                  </p>
                ) : (
                  comments.map((comment) => (
                    <div key={comment.id} className="border-l-4 border-indigo-200 pl-4 py-2">
                      <div className="flex items-center space-x-2 mb-2 text-sm text-gray-600">
                        <span className="font-medium">
                          {getDisplayName(
                            comment.author_id,
                            comment.author_name || '',
                            comment.author_class_name || '',
                            comment.is_anonymous
                          )}
                        </span>
                        <span>•</span>
                        <span>{formatDate(comment.created_at)}</span>
                      </div>
                      <p className="text-gray-800 whitespace-pre-wrap">
                        {comment.content}
                      </p>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}