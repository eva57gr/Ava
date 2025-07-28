'use client'

import { useState } from 'react'
import LoginForm from './LoginForm'
import SignupForm from './SignupForm'
import { LargeCloseIcon } from '../Icons'

interface AuthModalProps {
  isOpen: boolean
  onClose: () => void
  initialMode?: 'login' | 'signup'
}

export default function AuthModal({ isOpen, onClose, initialMode = 'login' }: AuthModalProps) {
  const [mode, setMode] = useState<'login' | 'signup'>(initialMode)

  if (!isOpen) return null

  const handleSuccess = () => {
    onClose()
  }

  const handleSwitchMode = () => {
    setMode(mode === 'login' ? 'signup' : 'login')
  }

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-2xl max-w-md w-full max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex justify-between items-center p-6 border-b border-gray-200">
          <h1 className="text-xl font-semibold text-gray-900">
            AI English Tutor
          </h1>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 transition-colors"
            aria-label="Close modal"
          >
            <LargeCloseIcon />
          </button>
        </div>

        {/* Content */}
        <div className="p-6">
          {mode === 'login' ? (
            <LoginForm 
              onSuccess={handleSuccess}
              onSwitchToSignup={handleSwitchMode}
            />
          ) : (
            <SignupForm 
              onSuccess={handleSuccess}
              onSwitchToLogin={handleSwitchMode}
            />
          )}
        </div>
      </div>
    </div>
  )
} 