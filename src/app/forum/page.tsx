'use client'

import { useState, useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import toast from 'react-hot-toast'
import ReactMarkdown from 'react-markdown'

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
  answer_id: number | string
  question_id: string
  user_id: number | string | null
  answer: string
  created_at: string
  username?: string
}

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000'
// Auto-detect wss:// if API_URL uses https://, otherwise use ws://
const WS_URL = process.env.NEXT_PUBLIC_WS_URL || 
  (API_URL.startsWith('https://') 
    ? API_URL.replace('https://', 'wss://') + '/ws'
    : API_URL.replace('http://', 'ws://') + '/ws')

console.log('WebSocket URL:', WS_URL)
console.log('API URL:', API_URL)

export default function ForumPage() {
  const router = useRouter()
  const [user, setUser] = useState<User | null>(null)
  const [questions, setQuestions] = useState<Question[]>([])
  const [newQuestion, setNewQuestion] = useState('')
  const [loading, setLoading] = useState(false)
  const [selectedQuestion, setSelectedQuestion] = useState<Question | null>(null)
  const [answers, setAnswers] = useState<Answer[]>([])
  const [answersCache, setAnswersCache] = useState<Record<string, Answer[]>>({})
  const selectedQuestionIdRef = useRef<string | null>(null)
  const [newAnswer, setNewAnswer] = useState('')
  const [aiSuggestion, setAiSuggestion] = useState('')
  const [isGeneratingAI, setIsGeneratingAI] = useState(false)
  const wsRef = useRef<WebSocket | null>(null)
  const pollIntervalRef = useRef<NodeJS.Timeout | null>(null)
  const [wsConnected, setWsConnected] = useState(false)

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
      if (pollIntervalRef.current) {
        clearInterval(pollIntervalRef.current)
      }
    }
  }, [])

  const setupWebSocket = () => {
    if (!WS_URL) {
      console.warn('Missing NEXT_PUBLIC_WS_URL; skipping WebSocket setup')
      return
    }

    console.log('Attempting WebSocket connection to:', WS_URL)

    // Close existing connection if any
    if (wsRef.current) {
      console.log('Closing existing WebSocket connection')
      wsRef.current.close()
    }

    const ws = new WebSocket(WS_URL)
    
    ws.onopen = () => {
      console.log('✅ WebSocket connected successfully to:', WS_URL)
      setWsConnected(true)
      // Clear polling if WebSocket is working
      if (pollIntervalRef.current) {
        clearInterval(pollIntervalRef.current)
        pollIntervalRef.current = null
      }
      // Send ping to keep connection alive
      const pingInterval = setInterval(() => {
        if (ws.readyState === WebSocket.OPEN) {
          ws.send(JSON.stringify({ type: 'ping' }))
          console.log('Sent ping to keep connection alive')
        } else {
          console.log('WebSocket not open, clearing ping interval')
          clearInterval(pingInterval)
        }
      }, 30000) // Ping every 30 seconds
      
      // Store interval ID for cleanup
      ;(ws as any).pingInterval = pingInterval
    }
    
    ws.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data)
        console.log('WebSocket message received:', data.type)
        
        if (data.type === 'new_question') {
          console.log('Processing new_question:', data.data)
          setQuestions(prev => {
            // Check if question already exists
            const exists = prev.some(q => q.question_id === data.data.question_id)
            if (exists) {
              console.log('Question already exists, skipping:', data.data.question_id)
              return prev
            }
            // Ensure username is set
            const questionData = {
              ...data.data,
              username: data.data.username || 'Anonymous'
            }
            console.log('Adding new question to list:', questionData)
            return [questionData, ...prev]
          })
          toast.success('New question received!', { icon: '🔔' })
        } else if (data.type === 'question_updated') {
          console.log('Processing question_updated:', data.data)
          setQuestions(prev =>
            prev.map(q => {
              if (q.question_id === data.data.question_id) {
                const updated = {
                  ...data.data,
                  username: data.data.username || q.username || 'Anonymous'
                }
                console.log('Updating question:', updated)
                return updated
              }
              return q
            })
          )
        } else if (data.type === 'new_answer') {
          console.log('🔔 WebSocket message received: new_answer', data.data)
          
          // Use ref to check if modal is open (more reliable than state in async handlers)
          const currentSelectedQId = selectedQuestionIdRef.current
          const answerQId = String(data.data.question_id)
          const questionIdMatch = currentSelectedQId !== null && currentSelectedQId === answerQId
          
          console.log('🔍 Answer WebSocket handler check:', {
            selectedQuestionIdRef: currentSelectedQId,
            answerQId,
            match: questionIdMatch,
            selectedQuestionState: selectedQuestion?.question_id
          })
          
          if (questionIdMatch) {
            console.log('✅ Answer modal is open for this question, updating answers list')
            setAnswers(prev => {
              // Check if answer already exists (handle both number and string IDs)
              const answerIdStr = String(data.data.answer_id)
              const exists = prev.some(a => {
                const aIdStr = String(a.answer_id)
                return aIdStr === answerIdStr
              })
              
              if (exists) {
                console.log('Answer already exists in list, skipping:', data.data.answer_id)
                return prev
              }
              
              const newAnswer: Answer = {
                ...data.data,
                username: data.data.username || 'Anonymous'
              }
              console.log('➕ Adding new answer to list. Previous count:', prev.length)
              const updated = [...prev, newAnswer]
              console.log('✅ New answer added! Updated count:', updated.length, 'Answer:', newAnswer)
              // update cache too
              setAnswersCache(cache => ({
                ...cache,
                [answerQId]: updated
              }))
              return updated
            })
          } else {
            console.log('⚠️ Answer modal not open for this question')
            console.log('Selected question ID (ref):', currentSelectedQId)
            console.log('Answer question ID:', answerQId)
            // Show notification - when user opens modal, fresh fetch will include it
            // Update cache so that opening the modal later will show the new answer
            setAnswersCache(cache => {
              const existing = cache[answerQId] || []
              const answerIdStr = String(data.data.answer_id)
              const exists = existing.some(a => String(a.answer_id) === answerIdStr)
              if (exists) return cache
              const updated = [...existing, { ...data.data, username: data.data.username || 'Anonymous' }]
              return { ...cache, [answerQId]: updated }
            })
            toast.success(`New answer posted!`, { icon: '💬' })
          }
        } else if (data.type === 'pong') {
          // Ignore pong messages
        }
      } catch (error) {
        console.error('Error parsing WebSocket message:', error, event.data)
      }
    }
    
    ws.onerror = (error) => {
      console.error('❌ WebSocket error:', error)
      console.error('WebSocket URL was:', WS_URL)
      console.error('WebSocket readyState:', ws.readyState)
    }
    
    ws.onclose = (event) => {
      console.log('⚠️ WebSocket disconnected. Code:', event.code, 'Reason:', event.reason, 'WasClean:', event.wasClean)
      setWsConnected(false)
      // Clear ping interval if it exists
      if ((ws as any).pingInterval) {
        clearInterval((ws as any).pingInterval)
      }
      // Fallback to polling if WebSocket fails
      if (!pollIntervalRef.current) {
        console.log('WebSocket failed, falling back to polling every 5 seconds')
        pollIntervalRef.current = setInterval(() => {
          fetchQuestions()
        }, 5000)
      }
      // Only reconnect if it wasn't a clean close (code 1000)
      if (event.code !== 1000) {
        console.log('Reconnecting WebSocket in 3 seconds...')
        setTimeout(setupWebSocket, 3000)
      }
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
    console.log('Opening answer modal for question:', question.question_id)
    setSelectedQuestion(question)
    selectedQuestionIdRef.current = String(question.question_id)
    // Reset AI suggestion when opening a new question
    setAiSuggestion('')
    setIsGeneratingAI(false)
    // Prefill from cache if available
    const cached = answersCache[String(question.question_id)]
    if (cached) {
      console.log('Using cached answers for question:', question.question_id, 'Count:', cached.length)
      setAnswers(cached)
    }
    
    try {
      const response = await fetch(`${API_URL}/api/answers/${question.question_id}`)
      const data = await response.json()
      console.log('Fetched answers for question:', question.question_id, 'Answers:', data.answers)
      const fetched = data.answers || []
      setAnswers(fetched)
      setAnswersCache(prev => ({
        ...prev,
        [String(question.question_id)]: fetched
      }))
    } catch (error) {
      console.error('Failed to fetch answers:', error)
      toast.error('Failed to fetch answers')
    }
  }

  const handleSubmitAnswer = async (e: React.FormEvent) => {
    e.preventDefault()
    
    if (!newAnswer.trim()) {
      toast.error('Answer cannot be empty')
      return
    }
    if (!selectedQuestion) {
      toast.error('Please open a question before answering')
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
        console.log('Answer submitted successfully:', data.answer)
        toast.success('Answer submitted!')
        setNewAnswer('')
        // Optimistically add answer - WebSocket will also send it but this ensures immediate update
        if (data.answer) {
          setAnswers(prev => {
            if (prev.some(a => a.answer_id === data.answer.answer_id)) {
              console.log('Answer already in list, skipping optimistic add')
              return prev
            }
            const answerWithUsername = {
              ...data.answer,
              username: data.answer.username || user?.username || 'Anonymous'
            }
            console.log('Adding answer optimistically:', answerWithUsername)
            const updated = [...prev, answerWithUsername]
            // sync cache for this question
            const qid = String(selectedQuestion.question_id)
            setAnswersCache(cache => ({
              ...cache,
              [qid]: updated
            }))
            return updated
          })
        }
      } else {
        toast.error('Failed to submit answer')
      }
    } catch (error) {
      toast.error('Error submitting answer')
    }
  }

  const handleGetAISuggestion = async () => {
    if (!selectedQuestion) return

    setIsGeneratingAI(true)
    setAiSuggestion('')

    try {
      const response = await fetch(`${API_URL}/api/questions/${selectedQuestion.question_id}/suggest`, {
        method: 'POST'
      })
      const data = await response.json()
      setAiSuggestion(data.suggestion)
      toast.success('AI suggestion generated!')
    } catch (error) {
      toast.error('Failed to get AI suggestion')
    } finally {
      setIsGeneratingAI(false)
    }
  }

  const handleCopyAISuggestion = () => {
    if (aiSuggestion) {
      navigator.clipboard.writeText(aiSuggestion)
      toast.success('AI suggestion copied to clipboard!')
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
                  console.log('Closing answer modal')
                  setSelectedQuestion(null)
                  selectedQuestionIdRef.current = null
                  setAnswers([])
                  setAiSuggestion('')
                  setIsGeneratingAI(false)
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
              disabled={isGeneratingAI}
              className="mb-4 inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-purple-500 text-white font-medium hover:bg-purple-600 transition text-sm disabled:opacity-60 disabled:cursor-not-allowed"
            >
              🤖 {isGeneratingAI ? 'Generating...' : 'Get AI Suggestion'}
            </button>

            {(isGeneratingAI || aiSuggestion) && (
              <div className="bg-purple-50 border border-purple-200 p-4 rounded-xl mb-4">
                <div className="flex justify-between items-start mb-2">
                  <p className="text-sm font-semibold text-purple-900">AI Suggestion:</p>
                  {aiSuggestion && (
                    <button
                      onClick={handleCopyAISuggestion}
                      className="inline-flex items-center gap-1 px-3 py-1 rounded-md bg-purple-100 text-purple-700 hover:bg-purple-200 transition text-xs font-medium"
                      title="Copy to clipboard"
                    >
                      📋 Copy
                    </button>
                  )}
                </div>
                {isGeneratingAI ? (
                  <div className="flex items-center gap-2 text-purple-700">
                    <div className="animate-spin rounded-full h-4 w-4 border-2 border-purple-700 border-t-transparent"></div>
                    <span className="text-sm">Generating answer...</span>
                  </div>
                ) : (
                  <div className="prose prose-sm max-w-none text-slate-900 prose-headings:text-slate-900 prose-p:text-slate-800 prose-strong:text-slate-900 prose-code:text-purple-700 prose-pre:bg-slate-800">
                    <ReactMarkdown>{aiSuggestion}</ReactMarkdown>
                  </div>
                )}
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