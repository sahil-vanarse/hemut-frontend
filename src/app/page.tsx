import Link from 'next/link'

export default function Home() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-500 to-purple-600">
      <div className="text-center text-white p-8">
        <h1 className="text-6xl font-bold mb-4">Hemut Q&A</h1>
        <p className="text-2xl mb-8">Real-time Question & Answer Dashboard</p>
        <div className="space-x-4">
          <Link 
            href="/login"
            className="bg-white text-blue-600 px-8 py-3 rounded-lg font-semibold hover:bg-gray-100 transition inline-block"
          >
            Login as Admin
          </Link>
          <Link 
            href="/forum"
            className="bg-transparent border-2 border-white text-white px-8 py-3 rounded-lg font-semibold hover:bg-white hover:text-blue-600 transition inline-block"
          >
            Continue as Guest
          </Link>
        </div>
        <div className="mt-8">
          <Link 
            href="/register"
            className="text-white underline hover:text-gray-200"
          >
            Don't have an account? Register here
          </Link>
        </div>
      </div>
    </div>
  )
}