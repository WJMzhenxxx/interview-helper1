import { create } from 'zustand'
import { devtools, immer } from 'zustand/middleware'

interface UserInfo {
  id: string
  username: string
  email: string
  avatar?: string
  role: 'user' | 'admin'
  createdAt: string
  lastLoginAt: string
}

interface UserConfigState {
  userInfo: UserInfo | null
  isAuthenticated: boolean
  setUserInfo: (userInfo: UserInfo | null) => void
  setAuthenticated: (isAuthenticated: boolean) => void
  logout: () => void
}

export const useUserConfigStore = create<UserConfigState>()(
  devtools(
    immer((set) => ({
      userInfo: null,
      isAuthenticated: false,
      setUserInfo: (userInfo) => set((state) => {
        state.userInfo = userInfo
      }),
      setAuthenticated: (isAuthenticated) => set((state) => {
        state.isAuthenticated = isAuthenticated
      }),
      logout: () => {
        localStorage.removeItem('token')
        set((state) => {
          state.userInfo = null
          state.isAuthenticated = false
        })
      },
    })),
    {
      name: 'user-config-store',
      trace: true,
      traceLimit: 25,
    }
  )
) 