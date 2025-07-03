import request from './request'

export interface SessionMessage {
  id: number
  message_type: string
  content: string
  message_metadata?: string
  timestamp: string
}

export interface InterviewSession {
  id: number
  session_id: string
  user_id: number
  title?: string
  created_at: string
  updated_at: string
  messages: SessionMessage[]
}

export interface InterviewSessionList {
  id: number
  session_id: string
  title?: string
  created_at: string
  updated_at: string
  message_count: number
}

export interface CreateSessionRequest {
  title?: string
}

export interface CreateMessageRequest {
  message_type: string
  content: string
  message_metadata?: string
}

// 创建新的面试会话
export const createSession = async (data: CreateSessionRequest): Promise<InterviewSession> => {
  return request.post('/api/sessions/', data)
}

// 获取用户的所有会话列表
export const getUserSessions = async (): Promise<InterviewSessionList[]> => {
  return request.get('/api/sessions/')
}

// 获取特定会话详情
export const getSession = async (sessionId: string): Promise<InterviewSession> => {
  return request.get(`/api/sessions/${sessionId}`)
}

// 向会话添加消息
export const addMessageToSession = async (
  sessionId: string, 
  message: CreateMessageRequest
): Promise<SessionMessage> => {
  return request.post(`/api/sessions/${sessionId}/messages`, message)
}

// 获取会话的所有消息
export const getSessionMessages = async (sessionId: string): Promise<SessionMessage[]> => {
  return request.get(`/api/sessions/${sessionId}/messages`)
}

// 删除会话
export const deleteSession = async (sessionId: string): Promise<{ detail: string }> => {
  return request.delete(`/api/sessions/${sessionId}`)
}