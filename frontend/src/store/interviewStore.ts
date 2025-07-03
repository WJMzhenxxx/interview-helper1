import { create } from 'zustand'
import { devtools } from 'zustand/middleware'
import { immer } from 'zustand/middleware/immer'
import * as sessionsApi from '../api/sessions';
/**
 * 语音转写结果接口
 * @property action - 动作类型
 * @property code - 状态码
 * @property data - 转写数据
 * @property desc - 描述信息
 * @property sid - 会话ID
 * @property timestamp - 时间戳
 * @property isFinal - 是否为最终结果
 */
interface TransResult {
  action: string
  code: string
  data: {
    cn: {
      st: {
        bg: string
        ed: string
        rt: Array<{
          ws: Array<{
            cw: Array<{
              w: string
              wp: string
            }>
            wb: number
            we: number
          }>
        }>
        type: string
      }
    }
    seg_id: number
    biz?: string
    src?: string
    dst?: string
    isEnd?: boolean
    rl?: number
  }
  desc: string
  sid: string
  timestamp: number
  isFinal: boolean
}

/**
 * 会议消息接口
 * @property id - 消息ID
 * @property timestamp - 时间戳
 * @property content - 消息内容
 * @property role - 消息角色（用户/助手）
 * @property status - 消息状态（发送中/已发送/错误）
 * @property error - 错误信息（可选）
 * @property audioUrl - 音频URL（可选）
 * @property duration - 音频时长（可选）
 * @property isTranslated - 是否已翻译（可选）
 * @property translatedContent - 翻译内容（可选）
 * @property metadata - 元数据（可选）
 */
export interface MeetingMessage {
  id: string
  timestamp: number
  content: string
  role: 'user' | 'asker'
  status: 'sending' | 'sent' | 'error'
  error?: string
  audioUrl?: string
  duration?: number
  isTranslated?: boolean
  translatedContent?: string
  isAsked?: boolean // 新增：是否已发送给AI
  metadata?: {
    modelUsed?: string
    tokensUsed?: number
    processingTime?: number
  }
}

/**
 * 新建面试页表单配置
 */
export interface InterviewConfig {
  hasReadGuide: boolean
  region: string
  job: string
  lang: string
  customQA: string
  qaLibStatus: string // 问答库状态
}

export interface Answer {
  id: string
  message: string
  created: number
  question: string
}

interface InterviewState {
  messages: MeetingMessage[]
  transResults: TransResult[]
  answers: Answer[]
  isRecording: boolean
  isProcessing: boolean
  interviewConfig: InterviewConfig
  currentSessionId: string | null
  sessionLoading: boolean
  setCurrentSessionId: (sessionId: string | null) => void
  createNewSession: (title?: string) => Promise<string | null>
  loadSession: (sessionId: string) => Promise<void>
  saveMessageToSession: (message: MeetingMessage) => Promise<void>
  setInterviewConfig: (config: Partial<InterviewConfig>) => void
  addMessage: (message: Omit<MeetingMessage, 'id' | 'timestamp'>) => void
  addTransResult: (result: Omit<TransResult, 'timestamp' | 'isFinal'>) => void
  addAnswer: (answer: Answer) => void
  updateAnswer: (id: string, message: string) => void
  upsertAnswer: (answer: Answer) => void
  setRecording: (isRecording: boolean) => void
  setProcessing: (isProcessing: boolean) => void
  clearMessages: () => void
  clearTransResults: () => void
  updateMessageStatus: (id: string, status: MeetingMessage['status'], error?: string) => void
  markMessagesAsAsked: (messageIds: string[]) => void
}

const defaultInterviewConfig: InterviewConfig = {
  hasReadGuide: false,
  region: '简体中文',
  job: '前端',
  lang: 'Typescript',
  customQA: '否',
  qaLibStatus: '空',
}

export const useInterviewStore = create<InterviewState>()(
  devtools(
    immer((set, get) => ({
      messages: [],
      transResults: [],
      answers: [],
      isRecording: false,
      isProcessing: false,
      interviewConfig: defaultInterviewConfig,
      currentSessionId: null,
      sessionLoading: false,
      setCurrentSessionId: (sessionId) => set((state) => {
        state.currentSessionId = sessionId
      }),
      createNewSession: async (title) => {
        try {
          set((state) => {
            state.sessionLoading = true
          })
          const session = await sessionsApi.createSession({ title })
          set((state) => {
            state.currentSessionId = session.session_id
            state.messages = []
            state.transResults = []
            state.answers = []
            state.sessionLoading = false
          })
          return session.session_id
        } catch (error) {
          console.error('Failed to create session:', error)
          set((state) => {
            state.sessionLoading = false
          })
          return null
        }
      },
      loadSession: async (sessionId) => {
        try {
          set((state) => {
            state.sessionLoading = true
          })
          const session = await sessionsApi.getSession(sessionId)
          
          // 转换后端消息格式到前端格式
          const convertedMessages: MeetingMessage[] = session.messages.map(msg => ({
            id: msg.id.toString(),
            timestamp: new Date(msg.timestamp).getTime(),
            content: msg.content,
            role: msg.message_type === 'user' ? 'user' : 'asker',
            status: 'sent' as const,
            metadata: msg.message_metadata ? JSON.parse(msg.message_metadata) : undefined
          }))
          
          set((state) => {
            state.currentSessionId = sessionId
            state.messages = convertedMessages
            state.sessionLoading = false
          })
        } catch (error) {
          console.error('Failed to load session:', error)
          set((state) => {
            state.sessionLoading = false
          })
        }
      },
      saveMessageToSession: async (message) => {
        const { currentSessionId } = get()
        if (!currentSessionId) return
        
        try {
          await sessionsApi.addMessageToSession(currentSessionId, {
            message_type: message.role === 'user' ? 'user' : 'assistant',
            content: message.content,
            message_metadata: message.metadata ? JSON.stringify(message.metadata) : undefined
          })
        } catch (error) {
          console.error('Failed to save message to session:', error)
        }
      },
      setInterviewConfig: (config) => set((state) => {
        state.interviewConfig = { ...state.interviewConfig, ...config }
      }),
      addMessage: (message) => {
        const newMessage: MeetingMessage = {
          ...message,
          id: Date.now().toString(),
          timestamp: Date.now(),
        }
        
        set((state) => {
          state.messages.push(newMessage)
        })
        
        // 异步保存到后端
        const { saveMessageToSession } = get()
        saveMessageToSession(newMessage).catch(console.error)
      },
      addTransResult: (result) => {
        try {
          set((state) => {
            state.transResults.push({
              ...result,
              timestamp: Date.now(),
              isFinal: result.data?.cn?.st?.type === '0',
            })
          })
        } catch (e) {
          console.error('addTransResult error', e, result)
        }
      },
      addAnswer: (answer) => set((state) => {
        state.answers.push(answer)
      }),
      updateAnswer: (id, message) => set((state) => {
        const idx = state.answers.findIndex(a => a.id === id)
        if (idx !== -1) {
          state.answers[idx].message += message
        }
      }),
      upsertAnswer: (answer) => set((state) => {
        const idx = state.answers.findIndex(a => a.id === answer.id)
        if (idx === -1) {
          state.answers.push(answer)
        } else {
          state.answers[idx] = answer
        }
      }),
      setRecording: (isRecording) => set((state) => {
        state.isRecording = isRecording
      }),
      setProcessing: (isProcessing) => set((state) => {
        state.isProcessing = isProcessing
      }),
      clearMessages: () => set((state) => {
        state.messages = []
      }),
      clearTransResults: () => set((state) => {
        state.transResults = []
      }),
      updateMessageStatus: (id, status, error) => set((state) => {
        state.messages = state.messages.map((msg) =>
          msg.id === id ? { ...msg, status, error } : msg
        )
      }),
      markMessagesAsAsked: (messageIds) => set((state) => {
        state.messages = state.messages.map((msg) =>
          messageIds.includes(msg.id) ? { ...msg, isAsked: true } : msg
        )
      }),
    })),
    {
      name: 'interview-store',
      trace: true,
      traceLimit: 25,
    }
  )
) 