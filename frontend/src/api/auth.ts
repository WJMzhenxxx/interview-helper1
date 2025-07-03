import request from './request'

export interface User {
  id: number
  username: string
  email?: string
  is_active: boolean
  created_at: string
  updated_at: string
}

export interface LoginRequest {
  username: string
  password: string
}

export interface RegisterRequest {
  username: string
  password: string
  email?: string
}

export interface LoginResponse {
  access_token: string
  token_type: string
}

// 用户登录
export const login = async (data: LoginRequest): Promise<LoginResponse> => {
  return request.post('/api/auth/login', data)
}

// 用户注册
export const register = async (data: RegisterRequest): Promise<User> => {
  return request.post('/api/auth/register', data)
}

// 获取当前用户信息
export const getCurrentUser = async (): Promise<User> => {
  return request.get('/api/auth/me')
}

// 用户登出
export const logout = async (): Promise<{ detail: string }> => {
  return request.post('/api/auth/logout')
}