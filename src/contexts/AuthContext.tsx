'use client'

import { createContext, useContext, useEffect, useState } from 'react'
import { User, Session, AuthError } from '@supabase/supabase-js'
import { createSupabaseClient } from '@/lib/supabase'
import { 
  isInIframe, 
  sendMessageToParent, 
  requestAuthFromParent, 
  storeAuthInParent, 
  clearAuthInParent,
  refreshSessionInParent
} from '@/utils/iframeAuth'

interface AuthContextType {
  user: User | null
  session: Session | null
  loading: boolean
  signUp: (email: string, password: string, fullName?: string) => Promise<{ error: AuthError | null }>
  signIn: (email: string, password: string) => Promise<{ error: AuthError | null }>
  signOut: () => Promise<{ error: AuthError | null }>
  resetPassword: (email: string) => Promise<{ error: AuthError | null }>
  isInIframe: boolean
}

const AuthContext = createContext<AuthContextType | undefined>(undefined)



export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [session, setSession] = useState<Session | null>(null)
  const [loading, setLoading] = useState(true)
  const [iframeAuth, setIframeAuth] = useState<{ user: User | null; session: Session | null } | null>(null)
  const supabase = createSupabaseClient()

  useEffect(() => {
    const initializeAuth = async () => {
      if (isInIframe()) {
        // Try to get auth from parent first
        const parentAuth = await requestAuthFromParent()
        if (parentAuth && parentAuth.session) {
          // Restore the Supabase session with the stored tokens
          const { data: { session }, error } = await supabase.auth.setSession({
            access_token: parentAuth.session.access_token,
            refresh_token: parentAuth.session.refresh_token,
          })
          
          if (!error && session) {
            setIframeAuth(parentAuth)
            setUser(session.user)
            setSession(session)
            setLoading(false)
            return
          }
        }
      }

      // Fall back to local Supabase auth
      const getSession = async () => {
        const { data: { session } } = await supabase.auth.getSession()
        setSession(session)
        setUser(session?.user ?? null)
        setLoading(false)
      }

      getSession()

      // Listen for auth changes
      const {
        data: { subscription },
      } = supabase.auth.onAuthStateChange((event, session) => {
        setSession(session)
        setUser(session?.user ?? null)
        setLoading(false)
        
        // Store in parent if in iframe
        if (event === 'TOKEN_REFRESHED') {
          // Update parent with refreshed session
          refreshSessionInParent(session?.user ?? null, session)
        } else {
          // Store in parent for other auth events
          storeAuthInParent(session?.user ?? null, session)
        }
      })

      return () => subscription.unsubscribe()
    }

    initializeAuth()

    // Set up periodic session refresh check for iframe mode
    let refreshInterval: NodeJS.Timeout | null = null
    if (isInIframe()) {
      refreshInterval = setInterval(async () => {
        try {
          const { data: { session } } = await supabase.auth.getSession()
          if (session && session.expires_at) {
            const now = Math.floor(Date.now() / 1000)
            // Refresh if session expires in the next 5 minutes
            if (session.expires_at - now < 300) {
              const { data: { session: refreshedSession } } = await supabase.auth.refreshSession()
              if (refreshedSession) {
                refreshSessionInParent(refreshedSession.user, refreshedSession)
              }
            }
          }
        } catch (error) {
          console.error('Error checking session refresh:', error)
        }
      }, 60000) // Check every minute
    }

    return () => {
      if (refreshInterval) {
        clearInterval(refreshInterval)
      }
    }
  }, [supabase])

  const signUp = async (email: string, password: string, fullName?: string) => {
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: {
          full_name: fullName,
        },
      },
    })

    if (!error && data.user) {
      // Create profile in public.profiles table
      const { error: profileError } = await supabase
        .from('profiles')
        .insert({
          id: data.user.id,
          email: data.user.email!,
          full_name: fullName,
        })

      if (profileError) {
        console.error('Error creating profile:', profileError)
      }
    }

    // Store in parent if in iframe
    if (!error && data.user) {
      storeAuthInParent(data.user, data.session)
    }

    return { error }
  }

  const signIn = async (email: string, password: string) => {
    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    })
    
    // Store in parent if in iframe
    if (!error && data.user) {
      storeAuthInParent(data.user, data.session)
    }
    
    return { error }
  }

  const signOut = async () => {
    const { error } = await supabase.auth.signOut()
    
    // Clear from parent if in iframe
    clearAuthInParent()
    
    return { error }
  }

  const resetPassword = async (email: string) => {
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/reset-password`,
    })
    return { error }
  }

  const value = {
    user,
    session,
    loading,
    signUp,
    signIn,
    signOut,
    resetPassword,
    isInIframe: isInIframe(),
  }

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export const useAuth = () => {
  const context = useContext(AuthContext)
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider')
  }
  return context
} 