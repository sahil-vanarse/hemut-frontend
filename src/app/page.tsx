import Link from 'next/link'

export default function Home() {
  return (
    <div className="min-h-screen relative overflow-hidden bg-gradient-to-br from-blue-600 via-purple-600 to-indigo-700">
      {/* Animated background particles */}
      <div className="absolute inset-0 overflow-hidden">
        <div className="absolute w-96 h-96 bg-white/10 rounded-full blur-3xl -top-48 -left-48 animate-pulse"></div>
        <div className="absolute w-96 h-96 bg-purple-300/10 rounded-full blur-3xl top-1/2 -right-48 animate-pulse" style={{ animationDelay: '1s' }}></div>
        <div className="absolute w-96 h-96 bg-blue-300/10 rounded-full blur-3xl -bottom-48 left-1/2 animate-pulse" style={{ animationDelay: '2s' }}></div>
      </div>

      {/* Main content */}
      <div className="relative min-h-screen flex items-center justify-center p-8">
        <div className="text-center text-white max-w-4xl mx-auto">
          {/* Logo/Title */}
          <div className="mb-8">
            <div className="inline-block mb-4">
              <div className="w-20 h-20 bg-white/20 backdrop-blur-sm rounded-2xl flex items-center justify-center mb-4 mx-auto border border-white/30">
                <span className="text-4xl">💬</span>
              </div>
            </div>
            <h1 className="text-7xl md:text-8xl font-black mb-4">
              Hemut Q&A
            </h1>
            <div className="h-1 w-32 bg-white/50 mx-auto mb-6"></div>
          </div>

          {/* Subtitle */}
          <p className="text-2xl md:text-3xl mb-12 text-blue-100 font-light">
            Real-time Question & Answer Dashboard
          </p>

          {/* Feature badges */}
          <div className="flex flex-wrap justify-center gap-4 mb-12">
            <div className="bg-white/10 backdrop-blur-md px-4 py-2 rounded-full border border-white/20 hover:bg-white/20 transition-all duration-300">
              <span className="text-sm font-medium">⚡ Real-time Updates</span>
            </div>
            <div className="bg-white/10 backdrop-blur-md px-4 py-2 rounded-full border border-white/20 hover:bg-white/20 transition-all duration-300">
              <span className="text-sm font-medium">🤖 AI-Powered</span>
            </div>
            <div className="bg-white/10 backdrop-blur-md px-4 py-2 rounded-full border border-white/20 hover:bg-white/20 transition-all duration-300">
              <span className="text-sm font-medium">🔒 Secure</span>
            </div>
          </div>

          {/* CTA Buttons */}
          <div className="flex flex-col sm:flex-row gap-4 justify-center items-center mb-8">
            <Link 
              href="/login"
              className="group relative bg-white text-blue-600 px-8 py-4 rounded-xl font-bold hover:shadow-2xl transition-all duration-300 inline-flex items-center gap-2 hover:scale-105 min-w-[200px] justify-center"
            >
              <span>Login as Admin</span>
              <span className="group-hover:translate-x-1 transition-transform">→</span>
            </Link>
            
            <Link 
              href="/forum"
              className="group relative bg-transparent border-2 border-white text-white px-8 py-4 rounded-xl font-bold hover:bg-white hover:text-blue-600 transition-all duration-300 inline-flex items-center gap-2 backdrop-blur-sm hover:scale-105 hover:shadow-2xl min-w-[200px] justify-center"
            >
              <span>Continue as Guest</span>
              <span className="group-hover:translate-x-1 transition-transform">→</span>
            </Link>
          </div>

          {/* Register link */}
          <div>
            <Link 
              href="/register"
              className="text-white/80 hover:text-white underline decoration-2 underline-offset-4 transition-all duration-300 inline-flex items-center gap-2 group text-lg"
            >
              <span>Don&apos;t have an account? Register here</span>
              <span className="group-hover:translate-x-1 transition-transform">→</span>
            </Link>
          </div>
          
        </div>
      </div>
    </div>
  )
}