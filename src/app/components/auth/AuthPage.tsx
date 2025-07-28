'use client'

import { useState } from 'react'
import LoginForm from './LoginForm'
import SignupForm from './SignupForm'

export default function AuthPage() {
  const [mode, setMode] = useState<'login' | 'signup'>('login')

  const handleSwitchMode = () => {
    setMode(mode === 'login' ? 'signup' : 'login')
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-xl max-w-md w-full p-8">
        {/* Header */}
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">
            AI English Tutor
          </h1>
          <p className="text-gray-600">
            {mode === 'login' 
              ? 'Welcome back! Sign in to continue your learning journey.' 
              : 'Join us and start improving your English today!'
            }
          </p>
        </div>

        {/* Content */}
        <div>
          {mode === 'login' ? (
            <LoginForm 
              onSwitchToSignup={handleSwitchMode}
            />
          ) : (
            <SignupForm 
              onSwitchToLogin={handleSwitchMode}
            />
          )}
        </div>
      </div>
    </div>
  )
} 