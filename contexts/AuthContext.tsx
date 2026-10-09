'use client'

import React, { createContext, useContext, useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import apiClient from '@/lib/api-client'
import { User } from '@/types'

interface AuthContextType {
  user: User | null
  isLoading: boolean
  login: (email: string, password: string) => Promise<void>
  logout: () => Promise<void>
  isAuthenticated: boolean
}

const AuthContext = createContext<AuthContextType | undefined>(undefined)

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const router = useRouter()

  useEffect(() => {
    checkAuth()
  }, [])

  const checkAuth = async () => {
    try {
      const token = localStorage.getItem('auth_token')
      if (token) {
        apiClient.setToken(token)
        const response = await apiClient.getCurrentUser()
        // Extract user from response structure { success: true, user: {...} }
        const userData = response.user || response.data || response
        
        // Map backend user fields to frontend User type
        const mappedUser = {
          id: userData.id,
          name: userData.name,
          firstName: userData.name ? userData.name.split(' ').slice(0, -1).join(' ') : '',
          lastName: userData.name ? userData.name.split(' ').pop() : '',
          email: userData.email,
          role: userData.role,
          phone: userData.phone,
          address: userData.address,
        }
        
        setUser(mappedUser)
      }
    } catch (error) {
      console.error('Auth check failed:', error)
      apiClient.clearToken()
    } finally {
      setIsLoading(false)
    }
  }

  const login = async (email: string, password: string) => {
    try {
      const response = await apiClient.login(email, password)
      apiClient.setToken(response.token)
      
      // Map backend user fields to frontend User type
      const userData = response.user
      const mappedUser = {
        id: userData.id,
        name: userData.name,
        firstName: userData.name ? userData.name.split(' ').slice(0, -1).join(' ') : '',
        lastName: userData.name ? userData.name.split(' ').pop() : '',
        email: userData.email,
        role: userData.role,
        phone: userData.phone,
        address: userData.address,
      }
      
      setUser(mappedUser)
      router.push(mappedUser.role?.toUpperCase() === 'TENANT' ? '/tenant/dashboard' : '/dashboard')
    } catch (error: any) {
      console.error('Login failed:', error)
      // Get the actual error message
      let errorMessage = 'Login failed. Please check your credentials.'
      
      if (error instanceof Error) {
        errorMessage = error.message
      } else if (typeof error === 'object' && error.message) {
        errorMessage = error.message
      } else if (typeof error === 'string') {
        errorMessage = error
      }
      
      throw new Error(errorMessage)
    }
  }

  const logout = async () => {
    // Import here to avoid circular dependency
    const { useLoading } = await import('./LoadingContext')
    
    try {
      // Note: useLoading hook cannot be called here in a promise context
      // This will be handled at the component level where logout is called
      await apiClient.logout()
    } catch (error) {
      console.error('Logout failed:', error)
    } finally {
      apiClient.clearToken()
      setUser(null)
      router.push('/login')
    }
  }

  return (
    <AuthContext.Provider
      value={{
        user,
        isLoading,
        login,
        logout,
        isAuthenticated: !!user,
      }}
    >
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const context = useContext(AuthContext)
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider')
  }
  return context
}
