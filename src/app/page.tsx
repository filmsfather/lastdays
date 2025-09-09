import Link from 'next/link'

export default function Home() {
  return (
    <div className="min-h-screen gradient-bg">
      {/* Navigation */}
      <nav className="relative z-10 px-6 py-6">
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
                Last Days
              </span>
            </h1>
            <p className="text-xl text-gray-600 max-w-3xl mx-auto leading-relaxed">
              직전대비기간 모의 실기 예약 시스템으로 체계적인 학습을 시작하세요
            </p>
          </div>
          
          <div className="flex flex-col sm:flex-row gap-4 justify-center mb-16">
            <Link 
              href="/login"
              className="btn-primary text-lg px-8 py-4 shadow-soft hover:shadow-medium transform hover:-translate-y-0.5 transition-all"
            >
              시작하기
            </Link>
            <button className="btn-secondary text-lg px-8 py-4">
              더 알아보기
            </button>
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
                <p className="text-lg text-gray-600 mb-6">
                  꿈을 향한 여정을 함께 시작해보세요
                </p>
                
                {/* YouTube Play Button */}
                <div className="inline-flex items-center px-8 py-4 bg-gradient-to-r from-red-500 to-red-600 text-white font-semibold rounded-2xl shadow-lg hover:shadow-xl transform hover:-translate-y-1 transition-all duration-300 group-hover:from-red-600 group-hover:to-red-700">
                  <svg className="w-6 h-6 mr-3" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z"/>
                  </svg>
                  YouTube에서 보기
                </div>
              </div>
            </a>
          </div>
        </div>

        {/* Features Grid */}
        <div className="grid md:grid-cols-3 gap-8 mt-24 animate-slide-up">
          <div className="card text-center group hover:shadow-medium transition-all duration-300 hover:-translate-y-2">
            <div className="w-16 h-16 bg-gradient-to-br from-blue-500 to-blue-600 rounded-2xl flex items-center justify-center mx-auto mb-4 group-hover:scale-110 transition-transform">
              <svg className="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
              </svg>
            </div>
            <h3 className="text-xl font-semibold text-gray-900 mb-2">스케줄 관리</h3>
            <p className="text-gray-600">효율적인 일정 관리와 예약 시스템으로 학습 계획을 세워보세요.</p>
          </div>

          <div className="card text-center group hover:shadow-medium transition-all duration-300 hover:-translate-y-2">
            <div className="w-16 h-16 bg-gradient-to-br from-green-500 to-green-600 rounded-2xl flex items-center justify-center mx-auto mb-4 group-hover:scale-110 transition-transform">
              <svg className="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <h3 className="text-xl font-semibold text-gray-900 mb-2">진도 추적</h3>
            <p className="text-gray-600">학습 진도를 실시간으로 확인하고 목표 달성도를 모니터링하세요.</p>
          </div>

          <div className="card text-center group hover:shadow-medium transition-all duration-300 hover:-translate-y-2">
            <div className="w-16 h-16 bg-gradient-to-br from-purple-500 to-purple-600 rounded-2xl flex items-center justify-center mx-auto mb-4 group-hover:scale-110 transition-transform">
              <svg className="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
              </svg>
            </div>
            <h3 className="text-xl font-semibold text-gray-900 mb-2">개인화 학습</h3>
            <p className="text-gray-600">각자의 학습 패턴에 맞춤화된 개인별 학습 경험을 제공합니다.</p>
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="mt-32 py-12 border-t border-gray-200">
        <div className="max-w-7xl mx-auto px-6 text-center">
          <p className="text-gray-500">
            © 2024 Last Days. 직전대비기간 모의 실기 예약 시스템
          </p>
        </div>
      </footer>
    </div>
  )
}