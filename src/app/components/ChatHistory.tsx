'use client'

import { useState, useEffect } from 'react'
import { useAuth } from '@/contexts/AuthContext'
import { createSupabaseClient } from '@/lib/supabase'

interface ChatSession {
  id: string
  title: string
  created_at: string
  messages: Array<{
    sender: 'user' | 'ai'
    text: string
  }>
}

interface ChatHistoryProps {
  onLoadSession: (messages: Array<{ sender: 'user' | 'ai'; text: string }>) => void
}

export default function ChatHistory({ onLoadSession }: ChatHistoryProps) {
  const [sessions, setSessions] = useState<ChatSession[]>([])
  const [loading, setLoading] = useState(true)
  const { user } = useAuth()
  const supabase = createSupabaseClient()

  useEffect(() => {
    if (user) {
      fetchChatHistory()
    }
  }, [user])

  const fetchChatHistory = async () => {
    try {
      const { data, error } = await supabase
        .from('chat_sessions')
        .select('*')
        .eq('user_id', user?.id)
        .order('created_at', { ascending: false })
        .limit(10)

      if (error) {
        console.error('Error fetching chat history:', error)
        return
      }

      setSessions(data || [])
    } catch (error) {
      console.error('Error:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleLoadSession = (session: ChatSession) => {
    onLoadSession(session.messages)
  }

  const formatDate = (dateString: string) => {
    const date = new Date(dateString)
    return date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    })
  }

  if (!user) return null

  if (loading) {
    return (
      <div className="p-4">
        <div className="animate-pulse space-y-2">
          <div className="h-4 bg-gray-200 rounded w-3/4"></div>
          <div className="h-4 bg-gray-200 rounded w-1/2"></div>
          <div className="h-4 bg-gray-200 rounded w-2/3"></div>
        </div>
      </div>
    )
  }

  return (
    <div className="p-4 border-t border-gray-200">
      <h3 className="text-sm font-medium text-gray-900 mb-3">Recent Conversations</h3>
      
      {sessions.length === 0 ? (
        <p className="text-sm text-gray-500">No previous conversations</p>
      ) : (
        <div className="space-y-2 max-h-40 overflow-y-auto">
          {sessions.map((session) => (
            <button
              key={session.id}
              onClick={() => handleLoadSession(session)}
              className="w-full text-left p-2 rounded-md hover:bg-gray-100 transition-colors"
            >
              <div className="flex justify-between items-start">
                <p className="text-sm font-medium text-gray-900 truncate">
                  {session.title}
                </p>
                <span className="text-xs text-gray-500 ml-2">
                  {formatDate(session.created_at)}
                </span>
              </div>
              <p className="text-xs text-gray-500 mt-1">
                {session.messages.length} messages
              </p>
            </button>
          ))}
        </div>
      )}
    </div>
  )
} 