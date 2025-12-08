'use client'

import { useState, useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import toast from 'react-hot-toast'

interface User {
  user_id: string
  username: string
  email: string
}

interface Question {
  question_id: string
  user_id: number | string | null
  message: string
  status: 'Pending' | 'Escalated' | 'Answered'
  created_at: string
  username?: string
}

interface Answer {
  answer_id: number
  question_id: string
  user_id: number | string | null
  answer: string
  created_at: string
  username?: string
}

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000'
const WS_URL = process.env.NEXT_PUBLIC_WS_URL || 'ws://localhost:8000/ws'

export default function ForumPage() {
  const router = useRouter()
  const [user, setUser] = useState<User | null>(null)
  const [questions, setQuestions] = useState<Question[]>([])
  const [newQuestion, setNewQuestion] = useState('')
  const [loading, setLoading] = useState(false)
  const [selectedQuestion, setSelectedQuestion] = useState<Question | null>(null)
  const [answers, setAnswers] = useState<Answer[]>([])
  const [newAnswer, setNewAnswer] = useState('')
  const [aiSuggestion, setAiSuggestion] = useState('')
  const wsRef = useRef<WebSocket | null>(null)

  useEffect(() => {
    // Check if user is logged in
    const userStr = localStorage.getItem('user')
    if (userStr) {
      try {
        const parsed = JSON.parse(userStr)
        setUser(parsed)
      } catch (err) {
        console.error('Failed to parse user from storage', err)
      }
    }

    // Fetch questions
    fetchQuestions()

    // Setup WebSocket
    setupWebSocket()

    return () => {
      if (wsRef.current) {
        wsRef.current.close()
      }
    }
  }, [])

  const setupWebSocket = () => {
    if (!WS_URL) {
      console.warn('Missing NEXT_PUBLIC_WS_URL; skipping WebSocket setup')
      return
    }

    const ws = new WebSocket(WS_URL)
    
    ws.onopen = () => {
      console.log('WebSocket connected')
    }
    
    ws.onmessage = (event) => {
      const data = JSON.parse(event.data)
      
      if (data.type === 'new_question') {
        setQuestions(prev => {
          if (prev.some(q => q.question_id === data.data.question_id)) {
            return prev
          }
          return [data.data, ...prev]
        })
        if (user) {
          toast.success('New question received!', { icon: '🔔' })
        }
      } else if (data.type === 'question_updated') {
        setQuestions(prev =>
          prev.map(q => (q.question_id === data.data.question_id ? data.data : q))
        )
      } else if (data.type === 'new_answer') {
        if (selectedQuestion?.question_id === data.data.question_id) {
          setAnswers(prev => {
            if (prev.some(a => a.answer_id === data.data.answer_id)) {
              return prev
            }
            return [...prev, data.data]
          })
        }
      }
    }
    
    ws.onerror = (error) => {
      console.error('WebSocket error:', error)
    }
    
    ws.onclose = () => {
      console.log('WebSocket disconnected, reconnecting...')
      setTimeout(setupWebSocket, 3000)
    }
    
    wsRef.current = ws
  }

  const fetchQuestions = async () => {
    try {
      const response = await fetch(`${API_URL}/api/questions`)
      const data = await response.json()
      const unique = data.questions.reduce((acc: Question[], curr: Question) => {
        if (!acc.some(q => q.question_id === curr.question_id)) {
          acc.push(curr)
        }
        return acc
      }, [])
      setQuestions(unique)
    } catch (error) {
      toast.error('Failed to fetch questions')
    }
  }

  const handleSubmitQuestion = async (e: React.FormEvent) => {
    e.preventDefault()
    
    if (!newQuestion.trim()) {
      toast.error('Question cannot be empty')
      return
    }

    setLoading(true)

    try {
      const xhr = new XMLHttpRequest()
      
      await new Promise((resolve, reject) => {
        xhr.open('POST', `${API_URL}/api/questions`, true)
        xhr.setRequestHeader('Content-Type', 'application/json')
        
        xhr.onload = () => {
          const body = xhr.responseText ? JSON.parse(xhr.responseText) : {}
          if (xhr.status === 200) {
            toast.success('Question submitted!')
            setNewQuestion('')
            // Optimistically add in case the websocket update lags
            setQuestions(prev => {
              const incoming = body.question
              if (!incoming || prev.some(q => q.question_id === incoming.question_id)) {
                return prev
              }
              return [incoming, ...prev]
            })
            resolve(body)
          } else {
            const detail = Array.isArray(body.detail)
              ? body.detail[0]?.msg || JSON.stringify(body.detail)
              : body.detail || 'Failed to submit question'
            toast.error(detail)
            reject(new Error(detail))
          }
        }
        
        xhr.onerror = () => reject(new Error('Network error'))
        
        xhr.send(JSON.stringify({
          message: newQuestion,
          user_id: user?.user_id || null
        }))
      })
    } catch (error) {
      console.error('Error:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleUpdateStatus = async (questionId: string, status: string) => {
    if (!user) {
      toast.error('Only admins can update status')
      return
    }

    try {
      const response = await fetch(`${API_URL}/api/questions/${questionId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status })
      })

      if (response.ok) {
        toast.success(`Question marked as ${status}`)
      } else {
        toast.error('Failed to update status')
      }
    } catch (error) {
      toast.error('Error updating status')
    }
  }

  const handleViewAnswers = async (question: Question) => {
    setSelectedQuestion(question)
    
    try {
      const response = await fetch(`${API_URL}/api/answers/${question.question_id}`)
      const data = await response.json()
      setAnswers(data.answers)
    } catch (error) {
      toast.error('Failed to fetch answers')
    }
  }

  const handleSubmitAnswer = async (e: React.FormEvent) => {
    e.preventDefault()
    
    if (!newAnswer.trim()) {
      toast.error('Answer cannot be empty')
      return
    }

    try {
      const response = await fetch(`${API_URL}/api/answers`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          question_id: selectedQuestion?.question_id,
          answer: newAnswer,
          user_id: user?.user_id || null
        })
      })

      if (response.ok) {
        const data = await response.json()
        toast.success('Answer submitted!')
        setNewAnswer('')
        setAnswers(prev => {
          if (prev.some(a => a.answer_id === data.answer?.answer_id)) {
            return prev
          }
          return [...prev, data.answer].filter(Boolean)
        })
      } else {
        toast.error('Failed to submit answer')
      }
    } catch (error) {
      toast.error('Error submitting answer')
    }
  }

  const handleGetAISuggestion = async () => {
    if (!selectedQuestion) return

    try {
      const response = await fetch(`${API_URL}/api/questions/${selectedQuestion.question_id}/suggest`, {
        method: 'POST'
      })
      const data = await response.json()
      setAiSuggestion(data.suggestion)
      toast.success('AI suggestion generated!')
    } catch (error) {
      toast.error('Failed to get AI suggestion')
    }
  }

  const handleLogout = () => {
    localStorage.removeItem('user')
    localStorage.removeItem('token')
    setUser(null)
    router.push('/')
    toast.success('Logged out successfully')
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'Pending': return 'bg-yellow-100 text-yellow-800'
      case 'Escalated': return 'bg-red-100 text-red-800'
      case 'Answered': return 'bg-green-100 text-green-800'
      default: return 'bg-gray-100 text-gray-800'
    }
  }

  const sortedQuestions = [...questions].sort((a, b) => {
    if (a.status === 'Escalated' && b.status !== 'Escalated') return -1
    if (a.status !== 'Escalated' && b.status === 'Escalated') return 1
    return new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
  })

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-slate-100 text-slate-900">
      {/* Header */}
      <header className="bg-white/80 backdrop-blur border-b border-slate-200 shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 flex justify-between items-center">
          <h1 className="text-3xl font-bold text-slate-900">Hemut Q&A Forum</h1>
          <div className="flex items-center space-x-3">
            {user ? (
              <>
                <span className="text-sm text-slate-600">
                  Welcome, <span className="font-semibold text-slate-900">{user.username}</span> (Admin)
                </span>
                <button
                  onClick={handleLogout}
                  className="px-4 py-2 rounded-lg bg-rose-500 text-white font-medium shadow hover:bg-rose-600 transition"
                >
                  Logout
                </button>
              </>
            ) : (
              <>
                <span className="text-sm text-slate-600">Guest User</span>
                <button
                  onClick={() => router.push('/login')}
                  className="px-4 py-2 rounded-lg bg-blue-600 text-white font-medium shadow hover:bg-blue-700 transition"
                >
                  Login as Admin
                </button>
              </>
            )}
          </div>
        </div>
      </header>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10 space-y-8">
        {/* Submit Question Form */}
        <div className="bg-white rounded-2xl shadow-lg border border-slate-100 p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl font-semibold text-slate-900">Ask a Question</h2>
            <span className="text-xs uppercase tracking-wide text-slate-500">Realtime updates on</span>
          </div>
          <form onSubmit={handleSubmitQuestion} className="space-y-4">
            <textarea
              className="w-full px-4 py-3 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-slate-900 placeholder-slate-400 bg-slate-50"
              rows={3}
              placeholder="Type your question here..."
              value={newQuestion}
              onChange={(e) => setNewQuestion(e.target.value)}
            />
            <button
              type="submit"
              disabled={loading}
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-blue-600 text-white font-semibold shadow hover:bg-blue-700 disabled:opacity-60 transition"
            >
              {loading ? 'Submitting...' : 'Submit Question'}
            </button>
          </form>
        </div>

        {/* Questions List */}
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-2xl font-semibold text-slate-900">All Questions ({questions.length})</h2>
          </div>
          {sortedQuestions.map((question) => (
            <div
              key={question.question_id}
              className="bg-white rounded-2xl shadow-lg border border-slate-100 p-6"
            >
              <div className="flex justify-between items-start mb-3">
                <div className="flex-1">
                  <p className="text-slate-900 font-semibold mb-2 leading-relaxed">{question.message}</p>
                  <div className="flex flex-wrap items-center space-x-3 text-sm text-slate-500">
                    <span>By: {question.username || 'Anonymous'}</span>
                    <span>•</span>
                    <span>{new Date(question.created_at).toLocaleString()}</span>
                  </div>
                </div>
                <span className={`px-3 py-1 rounded-full text-xs font-semibold ${getStatusColor(question.status)}`}>
                  {question.status}
                </span>
              </div>
              
              <div className="flex flex-wrap gap-2 mt-4">
                <button
                  onClick={() => handleViewAnswers(question)}
                  className="px-4 py-2 rounded-lg bg-slate-100 text-slate-700 font-medium hover:bg-slate-200 transition text-sm"
                >
                  View Answers
                </button>
                {user && (
                  <>
                    <button
                      onClick={() => handleUpdateStatus(question.question_id, 'Escalated')}
                      className="px-4 py-2 rounded-lg bg-amber-100 text-amber-800 font-medium hover:bg-amber-200 transition text-sm"
                    >
                      Escalate
                    </button>
                    <button
                      onClick={() => handleUpdateStatus(question.question_id, 'Answered')}
                      className="px-4 py-2 rounded-lg bg-emerald-100 text-emerald-800 font-medium hover:bg-emerald-200 transition text-sm"
                    >
                      Mark Answered
                    </button>
                  </>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Answer Modal */}
      {selectedQuestion && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-2xl w-full max-w-3xl max-h-[80vh] overflow-y-auto shadow-2xl border border-slate-100 p-6">
            <div className="flex justify-between items-start mb-4">
              <h3 className="text-xl font-semibold text-slate-900">Answers</h3>
              <button
                onClick={() => {
                  setSelectedQuestion(null)
                  setAnswers([])
                  setAiSuggestion('')
                }}
                className="text-slate-500 hover:text-slate-700 transition"
              >
                ✕
              </button>
            </div>

            <div className="bg-slate-50 p-4 rounded-xl mb-4 border border-slate-100">
              <p className="font-medium text-slate-900">{selectedQuestion.message}</p>
            </div>

            {/* AI Suggestion */}
            <button
              onClick={handleGetAISuggestion}
              className="mb-4 inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-purple-500 text-white font-medium hover:bg-purple-600 transition text-sm"
            >
              🤖 Get AI Suggestion
            </button>

            {aiSuggestion && (
              <div className="bg-purple-50 border border-purple-200 p-4 rounded-xl mb-4">
                <p className="text-sm text-slate-900"><strong>AI Suggestion:</strong> {aiSuggestion}</p>
              </div>
            )}

            {/* Answers List */}
            <div className="space-y-3 mb-4">
              {answers.length === 0 ? (
                <p className="text-slate-500 text-center py-4">No answers yet. Be the first to answer!</p>
              ) : (
                answers.map((answer) => (
                  <div key={answer.answer_id} className="bg-slate-50 p-4 rounded-xl border border-slate-100">
                    <p className="text-slate-900 mb-2">{answer.answer}</p>
                    <div className="text-xs text-slate-500">
                      By: {answer.username || 'Anonymous'} • {new Date(answer.created_at).toLocaleString()}
                    </div>
                  </div>
                ))
              )}
            </div>

            {/* Answer Form */}
            <form onSubmit={handleSubmitAnswer} className="space-y-3">
              <textarea
                className="w-full px-4 py-2 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-slate-50"
                rows={3}
                placeholder="Write your answer..."
                value={newAnswer}
                onChange={(e) => setNewAnswer(e.target.value)}
              />
              <button
                type="submit"
                className="px-5 py-2.5 rounded-xl bg-blue-600 text-white font-semibold shadow hover:bg-blue-700 transition"
              >
                Submit Answer
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}