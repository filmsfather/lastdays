import Link from 'next/link'

export default function Home() {
  // 환경별 배너 표시
  const isStaging = process.env.NEXT_PUBLIC_ENV === 'staging'
  const isDevelopment = process.env.NEXT_PUBLIC_ENV === 'development' || process.env.NODE_ENV === 'development'

  return (
    <div className="min-h-screen gradient-bg">
      {/* 환경별 배너 */}
      {(isStaging || isDevelopment) && (
        <div className={`fixed top-0 left-0 right-0 z-50 text-center py-2 text-white font-semibold text-sm ${
          isStaging ? 'bg-orange-500' : 'bg-purple-500'
        }`}>
          {isStaging ? '🧪 스테이징 환경입니다' : '🔧 개발 환경입니다'}
        </div>
      )}
      
      {/* Navigation */}
      <nav className={`relative z-10 px-6 py-6 ${(isStaging || isDevelopment) ? 'pt-14' : ''}`}>
        <div className="max-w-7xl mx-auto flex justify-between items-center">
          <div className="flex items-center space-x-2">
            <div className="w-8 h-8 bg-blue-600 rounded-xl flex items-center justify-center">
              <span className="text-white font-bold text-sm">L</span>
            </div>
            <span className="text-xl font-bold text-gray-900">Last Days</span>
          </div>
          <Link 
            href="/login"
            className="btn-primary"
          >
            로그인
          </Link>
        </div>
      </nav>

      {/* Hero Section */}
      <main className="max-w-7xl mx-auto px-6 py-24">
        <div className="text-center animate-fade-in">
          <div className="mb-8">
            <h1 className="text-6xl font-bold text-gray-900 mb-6 leading-tight">
              <span className="bg-gradient-to-r from-blue-600 via-purple-600 to-blue-600 bg-clip-text text-transparent">
                우디쌤의 영화입시 직전대비 예약 시스템
              </span>
            </h1>
          </div>
          
          <div className="flex flex-col sm:flex-row gap-4 justify-center mb-16">
            <Link 
              href="/login"
              className="btn-primary text-lg px-8 py-4 shadow-soft hover:shadow-medium transform hover:-translate-y-0.5 transition-all"
            >
              시작하기
            </Link>
          </div>
        </div>

        {/* Come and Dream with Me Section */}
        <div className="mt-32 mb-24 animate-slide-up">
          <div className="max-w-4xl mx-auto text-center">
            <a href="https://youtu.be/K3YAzNgSins?si=1wnX72lJc0rK8MbA" target="_blank" rel="noopener noreferrer" className="relative group cursor-pointer block">
              {/* Dream Image */}
              <div className="relative w-full h-96 rounded-3xl overflow-hidden shadow-soft hover:shadow-medium transition-all duration-500 group-hover:scale-105">
                <img 
                  src="/dream-image.jpg" 
                  alt="Come and Dream with Me" 
                  className="w-full h-full object-cover"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-black/40 via-black/10 to-transparent"></div>
                
                {/* Play button overlay */}
                <div className="absolute inset-0 flex items-center justify-center opacity-80 group-hover:opacity-100 transition-opacity duration-300">
                  <div className="w-20 h-20 bg-white/20 backdrop-blur-sm rounded-full flex items-center justify-center group-hover:scale-110 transition-transform duration-300 border-2 border-white/30">
                    <svg className="w-8 h-8 text-white ml-1" fill="currentColor" viewBox="0 0 24 24">
                      <path d="M8 5v14l11-7z"/>
                    </svg>
                  </div>
                </div>
              </div>
              
              {/* YouTube Link Text */}
              <div className="mt-8">
                <h2 className="text-4xl font-bold text-gray-900 mb-4 group-hover:text-purple-600 transition-colors duration-300">
                  Come and Dream with Me
                </h2>
                
              </div>
            </a>
          </div>
        </div>

      </main>

    </div>
  )
}