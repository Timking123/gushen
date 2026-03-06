import { create } from 'zustand'
import { persist } from 'zustand/middleware'

interface User {
  id: string
  email: string
}

interface AuthState {
  user: User | null
  token: string | null
  isAuthenticated: boolean
  isLoading: boolean
  setUser: (user: User | null) => void
  setToken: (token: string | null) => void
  login: (user: User, token: string) => void
  logout: () => void
  setLoading: (loading: boolean) => void
}

export const useAuthStore = create<AuthState>()(
  persist(
    set => ({
      user: null,
      token: null,
      isAuthenticated: false,
      isLoading: false,

      setUser: user =>
        set({
          user,
          isAuthenticated: !!user,
        }),

      setToken: token => {
        if (token) {
          localStorage.setItem('token', token)
        } else {
          localStorage.removeItem('token')
        }
        set({ token })
      },

      login: (user, token) => {
        localStorage.setItem('token', token)
        set({
          user,
          token,
          isAuthenticated: true,
        })
      },

      logout: () => {
        localStorage.removeItem('token')
        set({
          user: null,
          token: null,
          isAuthenticated: false,
        })
      },

      setLoading: loading => set({ isLoading: loading }),
    }),
    {
      name: 'auth-storage',
      partialize: state => ({
        user: state.user,
        token: state.token,
        isAuthenticated: state.isAuthenticated,
      }),
    }
  )
)
