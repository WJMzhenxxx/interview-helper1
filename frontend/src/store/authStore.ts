import { create } from 'zustand'
import { devtools } from 'zustand/middleware'
import { immer } from 'zustand/middleware/immer'
import * as authApi from '../api/auth'

export interface User {
  id: number
  username: string
  email?: string
  is_active: boolean
  created_at: string
  updated_at: string
}

interface AuthState {
  user: User | null
  token: string | null
  isLoading: boolean
  isAuthenticated: boolean
  login: (username: string, password: string) => Promise<boolean>
  register: (username: string, password: string, email?: string) => Promise<boolean>
  logout: () => void
  initAuth: () => Promise<void>
}

export const useAuthStore = create<AuthState>()(
  devtools(
    immer((set, get) => ({
      user: null,
      token: localStorage.getItem('token'),
      isLoading: false,
      isAuthenticated: false,
      
      login: async (username, password) => {
        try {
          set((state) => {
            state.isLoading = true
          })
          
          const response = await authApi.login({ username, password })
          const { access_token } = response
          
          // 保存token
          localStorage.setItem('token', access_token)
          
          // 获取用户信息
          const user = await authApi.getCurrentUser()
          
          set((state) => {
            state.token = access_token
            state.user = user
            state.isAuthenticated = true
            state.isLoading = false
          })
          
          return true
        } catch (error) {
          console.error('Login failed:', error)
          set((state) => {
            state.isLoading = false
          })
          return false
        }
      },
      
      register: async (username, password, email) => {
        try {
          set((state) => {
            state.isLoading = true
          })
          
          await authApi.register({ username, password, email })
          
          // 注册成功后自动登录
          const loginSuccess = await get().login(username, password)
          
          set((state) => {
            state.isLoading = false
          })
          
          return loginSuccess
        } catch (error) {
          console.error('Registration failed:', error)
          set((state) => {
            state.isLoading = false
          })
          return false
        }
      },
      
      logout: () => {
        // 调用后端登出API（可选）
        authApi.logout().catch(console.error)
        
        // 清除本地状态
        localStorage.removeItem('token')
        set((state) => {
          state.user = null
          state.token = null
          state.isAuthenticated = false
        })
      },
      
      initAuth: async () => {
        const token = localStorage.getItem('token')
        if (!token) {
          set((state) => {
            state.isAuthenticated = false
          })
          return
        }
        
        try {
          set((state) => {
            state.isLoading = true
          })
          
          const user = await authApi.getCurrentUser()
          
          set((state) => {
            state.token = token
            state.user = user
            state.isAuthenticated = true
            state.isLoading = false
          })
        } catch (error) {
          console.error('Auth initialization failed:', error)
          // Token无效，清除
          localStorage.removeItem('token')
          set((state) => {
            state.token = null
            state.user = null
            state.isAuthenticated = false
            state.isLoading = false
          })
        }
      },
    })),
    {
      name: 'auth-store',
      trace: true,
      traceLimit: 25,
    }
  )
)