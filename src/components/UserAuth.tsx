'use client'

import React, { useState, useEffect, FormEvent, ChangeEvent } from 'react'
import { createClient } from '@/lib/supabaseClient'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input' // Assuming Shadcn Input
import { Label } from '@/components/ui/label'   // Assuming Shadcn Label
import type { User } from '@supabase/supabase-js'
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Terminal } from "lucide-react"
import { useRouter } from 'next/navigation'

export default function UserAuth() {
  const supabase = createClient()
  const [user, setUser] = useState<User | null>(null)
  const [loading, setLoading] = useState(true)
  const [isSignUp, setIsSignUp] = useState(false) // Toggle between Sign In / Sign Up form
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [message, setMessage] = useState<string | null>(null) // For success messages like "Check your email"
  const router = useRouter()
  
  useEffect(() => {
    // Initial user fetch
    setLoading(true)
    supabase.auth.getUser().then(({ data: { user } }) => {
      setUser(user)
      setLoading(false)
    })

    // Auth state listener
    const { data: authListener } = supabase.auth.onAuthStateChange(
      (event, session) => {
        console.log('[UserAuth] Auth state changed:', event, session);
        setUser(session?.user ?? null)
        setError(null) // Clear errors on auth change
        setMessage(null)
        setEmail('') // Clear form on auth change
        setPassword('')
        setLoading(false)
      }
    )

    return () => {
      authListener?.subscription.unsubscribe()
    }
  }, [supabase.auth])

  const handleAuthAction = async (event: FormEvent) => {
    event.preventDefault()
    setLoading(true)
    setError(null)
    setMessage(null)

    try {
      if (isSignUp) {
        // --- Sign Up --- 
        const { data, error } = await supabase.auth.signUp({
          email,
          password,
          // options: {
          //   emailRedirectTo: `${window.location.origin}/auth/callback`, // Optional: Redirect after email confirmation
          // },
        })
        if (error) throw error
        // Check if email confirmation is required
        if (data.user && data.user.identities?.length === 0) {
            setMessage("Signup successful, but email confirmation might be required. Check Supabase settings.");
        } else {
             setMessage("Signup successful! Check your email for the confirmation link.");
        }
        // Potentially clear form here or wait for onAuthStateChange

      } else {
        // --- Sign In --- 
        const { error } = await supabase.auth.signInWithPassword({
          email,
          password,
        })
        if (error) throw error
        // Login success is handled by onAuthStateChange
        setMessage("Login successful!"); // Can provide immediate feedback
      }
    } catch (error: any) {
      console.error(`Error ${isSignUp ? 'signing up' : 'signing in'}:`, error)
      setError(error.error_description || error.message || "An unexpected error occurred.")
    } finally {
      setLoading(false)
    }
  }

  const handleLogout = async () => {
    setLoading(true)
    setError(null)
    setMessage(null)
    const { error } = await supabase.auth.signOut()
    if (error) {
      console.error('Error logging out:', error.message)
      setError(error.message)
    }
    // State update handled by onAuthStateChange
    setLoading(false)
  }

  // Initial loading state
  if (loading && !user) {
     return <div className="text-xs text-gray-500 dark:text-gray-400 p-2 text-center">Loading...</div>
  }

  // Logged In View
  if (user) {
    return (
      <div className="p-1 text-center space-y-1 w-full">
        <p className="text-xs text-gray-600 dark:text-gray-300 break-all truncate" title={user.email}>
           {user.email}
        </p>
        <div className="flex flex-col sm:flex-row gap-1 justify-center">
            <Button variant="outline" onClick={() => router.push('/dashboard')} size="sm" disabled={loading} className="flex-1 text-xs px-2 py-1 h-auto">
            Dashboard
            </Button>
            <Button variant="outline" onClick={handleLogout} size="sm" disabled={loading} className="flex-1 text-xs px-2 py-1 h-auto">
            Logout
            </Button>
        </div>
      </div>
    )
  }

  // Logged Out View (Sign In / Sign Up Form)
  return (
    <div className="p-2 space-y-2">
      <h4 className="text-xs font-semibold text-center text-gray-700 dark:text-gray-300 mb-1">
          {isSignUp ? 'Create Account' : 'Sign In'}
      </h4>
      <form onSubmit={handleAuthAction} className="space-y-2">
        <div>
          <Input
            id="email"
            type="email"
            value={email}
            onChange={(e: ChangeEvent<HTMLInputElement>) => setEmail(e.target.value)}
            required
            placeholder="Email"
            className="text-xs px-2 py-1 h-auto"
            disabled={loading}
          />
        </div>
        <div>
            <Input
                id="password"
                type="password"
                value={password}
                onChange={(e: ChangeEvent<HTMLInputElement>) => setPassword(e.target.value)}
                required
                placeholder="Password"
                className="text-xs px-2 py-1 h-auto"
                disabled={loading}
            />
        </div>
        <Button type="submit" className="w-full text-xs py-1 h-auto" disabled={loading} size="sm">
          {loading ? 'Processing...' : (isSignUp ? 'Sign Up' : 'Sign In')}
        </Button>
      </form>

      {/* Display Messages/Errors */} 
      {error && (
          <Alert variant="destructive" className="mt-2 p-2 text-xs">
             <AlertTitle className="text-xs mb-0.5">Error</AlertTitle>
             <AlertDescription className="text-xs">{error}</AlertDescription>
          </Alert>
       )}
       {message && (
           <Alert variant="default" className="mt-2 p-2 text-xs border-green-500 text-green-700 dark:text-green-400 dark:border-green-600">
             <AlertTitle className="text-xs mb-0.5">Success</AlertTitle>
             <AlertDescription className="text-xs">{message}</AlertDescription>
          </Alert>
       )}

      <button 
        onClick={() => { 
            setIsSignUp(!isSignUp);
            setError(null); // Clear errors when switching form
            setMessage(null);
        }} 
        className="text-xs text-center w-full text-blue-600 hover:underline dark:text-blue-400 disabled:opacity-50 mt-1"
        disabled={loading}
      >
        {isSignUp ? 'Have an account? Sign In' : 'Need an account? Sign Up'}
      </button>
    </div>
  )
} 