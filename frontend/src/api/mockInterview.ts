import request from './request'

/** 模拟面试配置 */
export interface MockInterviewConfig {
  jd: string
  resume: string
  level: 'unlimited' | 'high' | 'medium' | 'low'
}

/** 创建会话响应 */
export interface MockSession {
  id: number
  session_id: string
  jd?: string
  resume?: string
  level: string
  created_at: string
  updated_at: string
  messages: MockMessage[]
}

export interface MockMessage {
  id: number
  role: 'interviewer' | 'ai'
  content: string
  created_at: string
}

/** 创建模拟面试会话 */
export async function createMockSession(config: MockInterviewConfig): Promise<MockSession> {
  return request.post('/api/mock-interview/sessions', {
    jd: config.jd,
    resume: config.resume,
    level: config.level,
  })
}

/** 读取模拟面试会话（含全部消息） */
export async function getMockSession(sessionId: string): Promise<MockSession> {
  return request.get(`/api/mock-interview/sessions/${sessionId}`)
}

/** 列出当前用户的模拟面试会话 */
export async function listMockSessions(): Promise<MockSession[]> {
  return request.get('/api/mock-interview/sessions/')
}

function getToken(): string | null {
  return localStorage.getItem('token')
}

/**
 * 触发 AI 面试者作答（SSE 流式）。
 * 返回一个可中止的控制器，通过 onDelta/onError/onDone 回调接收结果。
 */
export function streamMockRespond(
  sessionId: string,
  interviewerMessage: string,
  handlers: {
    onDelta: (text: string) => void
    onError?: (msg: string) => void
    onDone?: () => void
  },
  timeoutSeconds = 10,
): { abort: () => void } {
  const controller = new AbortController()
  const token = getToken()

  ;(async () => {
    try {
      const res = await fetch(`/api/mock-interview/sessions/${sessionId}/respond`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({
          session_id: sessionId,
          interviewer_message: interviewerMessage,
          timeout_seconds: timeoutSeconds,
        }),
        signal: controller.signal,
      })

      if (!res.ok) {
        let detail = `HTTP ${res.status}`
        try {
          const j = await res.json()
          if (j?.detail) detail = j.detail
        } catch { /* ignore */ }
        handlers.onError?.(detail)
        handlers.onDone?.()
        return
      }

      const reader = res.body?.getReader()
      if (!reader) {
        handlers.onError?.('响应无内容')
        handlers.onDone?.()
        return
      }
      const decoder = new TextDecoder()
      let buffer = ''
      while (true) {
        const { done, value } = await reader.read()
        if (done) break
        buffer += decoder.decode(value, { stream: true })
        const lines = buffer.split('\n')
        buffer = lines.pop() || ''
        for (const line of lines) {
          const trimmed = line.trim()
          if (!trimmed.startsWith('data: ')) continue
          const data = trimmed.slice(6)
          if (data.startsWith('[ERROR]')) {
            handlers.onError?.(data.slice(7))
          } else {
            handlers.onDelta(data)
          }
        }
      }
      handlers.onDone?.()
    } catch (err: any) {
      if (err?.name === 'AbortError') return
      handlers.onError?.(err?.message || '请求失败')
      handlers.onDone?.()
    }
  })()

  return { abort: () => controller.abort() }
}
