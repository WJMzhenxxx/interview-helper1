import type { MeetingMessage } from '../store/interviewStore'

/**
 * 滑动窗口策略：获取最近的消息
 * @param messages 所有消息
 * @param timeWindow 时间窗口（毫秒，默认30秒）
 * @param countWindow 消息数量窗口（默认30条）
 * @returns 最近的消息数组
 */
export const getRecentMessages = (
  messages: MeetingMessage[], 
  timeWindow = 30000, 
  countWindow = 30
): MeetingMessage[] => {
  const now = Date.now()
  const timeFiltered = messages.filter(m => now - m.timestamp <= timeWindow)
  const countFiltered = messages.slice(-countWindow)
  
  // 取两个条件的交集，选择更小的集合
  return timeFiltered.length <= countFiltered.length ? timeFiltered : countFiltered
}

/**
 * 稳定的系统提示词（用于KV Cache优化）
 */
export const STABLE_SYSTEM_PROMPT = `你是专业的AI面试助手，负责识别和回答面试中的新问题。

## 容错处理规则：
1. **语音识别错误容忍**：忽略明显的识别错误，如"note js"理解为"Node.js"，"浏览器使用的引擎"可能被错误分割
2. **角色混淆处理**：根据内容语义判断真实角色，不完全依赖标记的role
3. **内容碎片拼接**：将语义相关的碎片内容理解为完整问题，标点符号可能分离到下一句
4. **标点符号容错**：问号可能被识别为句号，根据语义判断疑问意图

## 核心任务：
- 识别消息中的**新问题**（标记为[新消息]的内容）
- 忽略已回答的问题（标记为[历史]的内容仅作参考）
- 如果发现新问题，提供简洁专业的回答
- 如果没有新问题，回复"未检测到新问题"

## 回答要求：
- 回答要简洁、专业、针对性强
- 避免重复回答已处理过的问题
- 语气自然，适合面试场景
- 重点关注技术问题和面试相关问题`

/**
 * 为DeepSeek API准备消息，优化KV Cache命中率
 * @param messages 所有消息
 * @returns 准备好的AI消息和新消息ID列表
 */
export const prepareMessagesForAI = (messages: MeetingMessage[]) => {
  const recentMessages = getRecentMessages(messages)
  
  // 分离已问过的和新的消息
  const askedMessages = recentMessages.filter(m => m.isAsked)
  const newMessages = recentMessages.filter(m => !m.isAsked)
  
  // 如果没有新消息，直接返回
  if (newMessages.length === 0) {
    return { aiMessages: [], newMessageIds: [] }
  }
  
  // 构建稳定的前缀（system prompt + 历史消息）
  const stablePrefix = [
    {
      role: 'system' as const,
      content: STABLE_SYSTEM_PROMPT
    }
  ]
  
  // 已处理的历史消息作为稳定前缀（按时间戳排序保持稳定）
  const sortedAskedMessages = askedMessages
    .sort((a, b) => a.timestamp - b.timestamp)
    .map(m => ({
      role: m.role === 'user' ? 'user' as const : 'assistant' as const,
      content: `[历史] ${m.content}`
    }))
  
  // 新消息追加在后面（按时间戳排序）
  const sortedNewMessages = newMessages
    .sort((a, b) => a.timestamp - b.timestamp)
    .map(m => ({
      role: m.role === 'user' ? 'user' as const : 'assistant' as const,
      content: `[新消息] ${m.content}`
    }))
  
  // 为了最大化缓存命中，保持稳定的消息结构
  const aiMessages = [
    ...stablePrefix,
    ...sortedAskedMessages,
    ...sortedNewMessages
  ]
  
  return {
    aiMessages,
    newMessageIds: newMessages.map(m => m.id)
  }
}

// 全局状态：追踪静音持续时间
let lastAudioActiveTime = Date.now()
let silenceStartTime: number | null = null

/**
 * 更新音频活跃状态并追踪静音时间
 * @param audioActive 当前音频是否活跃
 */
export const updateAudioActiveState = (audioActive: boolean) => {
  const now = Date.now()
  
  if (audioActive) {
    // 有声音，重置静音追踪
    lastAudioActiveTime = now
    silenceStartTime = null
  } else {
    // 无声音，开始或继续追踪静音
    if (silenceStartTime === null) {
      silenceStartTime = now
    }
  }
}

/**
 * 检查是否应该触发AI问题检测
 * @param lastDataTime 最后收到数据的时间
 * @returns 是否应该触发
 */
export const shouldTriggerQuestionDetection = (lastDataTime: number): boolean => {
  // 注意：具体的触发条件已经在预检查和主动检查中实现
  // 如果调用到这里，说明已经满足了触发条件
  // 这里保留作为统一的检查入口，未来可以添加其他条件
  
  // TODO: 未来可以在这里添加其他触发条件，例如：
  // - 关键词检测
  // - 语义分析
  // - 用户自定义规则
  
  return true // 直接返回true，因为调用时已经过滤了条件
}

/**
 * 防抖处理类
 */
export class QuestionDetectionDebouncer {
  private timer: number | null = null
  private readonly delay: number
  
  constructor(delay = 500) {
    this.delay = delay
  }
  
  /**
   * 防抖执行函数
   * @param callback 要执行的回调函数
   */
  debounce(callback: () => void): void {
    if (this.timer) {
      clearTimeout(this.timer)
    }
    
    this.timer = window.setTimeout(() => {
      callback()
      this.timer = null
    }, this.delay)
  }
  
  /**
   * 取消待执行的防抖
   */
  cancel(): void {
    if (this.timer) {
      clearTimeout(this.timer)
      this.timer = null
    }
  }
  
  /**
   * 清理资源
   */
  destroy(): void {
    this.cancel()
  }
}