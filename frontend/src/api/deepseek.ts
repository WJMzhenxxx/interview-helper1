import { useApiConfigStore } from '../store/apiConfigStore'
import { useInterviewStore } from '@/store/interviewStore'
import { message as antdMessage } from 'antd'

/**
 * DeepSeek API 响应接口
 */
interface DeepSeekResponse {
  id: string
  object: string
  created: number
  model: string
  choices: Array<{
    index: number
    message: {
      role: string
      content: string
    }
    finish_reason: string
  }>
  usage: {
    prompt_tokens: number
    completion_tokens: number
    total_tokens: number
  }
}

/**
 * DeepSeek API 请求参数接口
 */
interface DeepSeekRequest {
  model: string
  messages: Array<{
    role: 'user' | 'assistant' | 'system'
    content: string
  }>
  temperature?: number
  max_tokens?: number
  stream?: boolean
}

const DEEPSEEK_BASE_URL = 'https://api.deepseek.com'

/**
 * 获取DeepSeek配置
 * @returns DeepSeek配置
 */
const getDeepSeekConfig = () => {
  const { apiConfigs } = useApiConfigStore.getState()
  const config = apiConfigs.find(config => config.apiProvider === 'deepseek')
  if (!config) {
    throw new Error('DeepSeek configuration not found')
  }
  return config
}

/**
 * 调用 DeepSeek API 进行对话
 * @param messages 对话消息数组
 * @param options 可选参数
 * @returns Promise<DeepSeekResponse>
 */
export const chatWithDeepSeek = async (
  messages: DeepSeekRequest['messages'],
  options?: {
    temperature?: number
    max_tokens?: number
    stream?: boolean
  }
): Promise<DeepSeekResponse> => {
  const config = getDeepSeekConfig()
  const response = await fetch(`${DEEPSEEK_BASE_URL}/chat/completions`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${config.apiKey}`
    },
    body: JSON.stringify({
      model: config.model || 'deepseek-chat',
      messages,
      temperature: options?.temperature ?? config.temperature,
      max_tokens: options?.max_tokens ?? config.maxTokens,
      stream: options?.stream ?? false
    })
  })
  if (!response.ok) {
    throw new Error(`HTTP error! status: ${response.status}`)
  }
  return await response.json()
}

/**
 * 流式调用 DeepSeek API
 * @param messages 对话消息数组
 * @param onMessage 消息回调函数
 * @param options 可选参数
 */
export const streamChatWithDeepSeek = async (
  messages: DeepSeekRequest['messages'],
  onMessage: (parsed: any) => void,
  options?: {
    temperature?: number
    max_tokens?: number
  }
): Promise<void> => {
  const config = getDeepSeekConfig()
  const response = await fetch(`${DEEPSEEK_BASE_URL}/chat/completions`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${config.apiKey}`
    },
    body: JSON.stringify({
      model: config.model || 'deepseek-chat',
      messages,
      temperature: options?.temperature ?? config.temperature,
      max_tokens: options?.max_tokens ?? config.maxTokens,
      stream: true
    })
  })
  if (!response.ok) {
    throw new Error(`HTTP error! status: ${response.status}`)
  }
  const reader = response.body?.getReader()
  if (!reader) {
    throw new Error('No response body')
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
      if (line.startsWith('data: ')) {
        const data = line.slice(6)
        if (data === '[DONE]') continue
        try {
          const parsed = JSON.parse(data)
          onMessage(parsed)
        } catch (e) {
          // 忽略解析错误
        }
      }
    }
  }
}

/**
 * 智能问题检测和回答处理（KV Cache优化版本）
 */
export const handleQuestionDetected = async () => {
  const store = useInterviewStore.getState()
  const { upsertAnswer, markMessagesAsAsked, messages } = store
  
  // 动态导入工具函数以避免循环依赖
  const { prepareMessagesForAI } = await import('../utils/questionDetection')
  
  // 准备消息（KV Cache优化）
  const { aiMessages, newMessageIds } = prepareMessagesForAI(messages)
  
  // 如果没有新消息，直接返回
  if (aiMessages.length === 0 || newMessageIds.length === 0) {
    return
  }
  
  let fullMsg = ''
  let answerId = ''
  
  try {
    await streamChatWithDeepSeek(aiMessages, (parsed) => {
      const id = parsed.id || (parsed.choices && parsed.choices[0]?.id) || 'deepseek-' + Date.now()
      const content = parsed.choices?.[0]?.delta?.content || ''
      
      if (!answerId) answerId = id
      
      if (content) {
        fullMsg += content
        // 实时更新回答
        upsertAnswer({
          id: answerId,
          message: fullMsg,
          created: Date.now(),
          question: newMessageIds.map(id => 
            messages.find(m => m.id === id)?.content || ''
          ).join(' ')
        })
      }
    })
    
    // 标记消息为已处理，优化后续KV Cache命中
    markMessagesAsAsked(newMessageIds)
    
  } catch (err: any) {
    // DeepSeek API错误处理
    const reason = err?.choices?.[0]?.finish_reason || err?.message || 'AI接口调用失败'
    antdMessage.error(reason)
    console.error('DeepSeek API Error:', err)
  }
}

/**
 * 兼容性：保持原有的handleQuestionEnd方法
 * @deprecated 请使用 handleQuestionDetection 方法
 */
export const handleQuestionEnd = handleQuestionDetected 