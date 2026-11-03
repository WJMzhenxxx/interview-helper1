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
 * 稳定的系统提示词生成函数（用于KV Cache优化）
 *
 * 根据预设的"使用者身份"动态定制 AI 扮演的角色：
 * - 使用者=面试官 → AI 扮演面试者，针对面试官的问题作答
 * - 使用者=面试者 → AI 扮演面试官，识别面试官的问题并给出作答提示
 *
 * 注意：role 的取值只有两种（面试官/面试者），因此系统提示词集合是有限的，
 * 前段稳定前缀依然能在有限集合内保持较高的 KV Cache 命中率。
 */
export const buildSystemPrompt = (role: 'interviewer' | 'interviewee'): string => {
  const isInterviewerUser = role === 'interviewer'

  if (isInterviewerUser) {
    // 使用者是面试官 → AI 扮演被面试者（求职者）
    return `你是专业的AI面试助手。当前【使用者是面试官】，你在扮演【被面试者（求职者）】。

## 核心任务
- 识别转写中【面试官】提出的问题（标记为 [面试官] 的[新消息]内容）
- 以【被面试者】的身份，给出简明、专业、贴合岗位的回答
- 忽略自己的语音（转写中不会包含面试者的内容，因为已在进 AI 前剔除）

## 回答要求
- 以第一人称求职者口吻回答，像真实面试者作答
- 回答要简洁、专业、针对性强
- 避免重复回答已处理过的问题
- 语气自然，适合面试场景
- 重点关注技术问题和面试相关问题`
  }

  // 使用者是面试者 → AI 扮演面试官，提供作答帮助
  return `你是专业的AI面试助手。当前【使用者是面试者/求职者】，你在扮演【面试官】的角色，帮助使用者准备面试。

## 核心任务
- 识别转写中【面试官】的提问（标记为 [面试官] 的[新消息]内容）
- 站在面试官角度判断问题意图，并给使用者提供【如何回答这道题】的建议
- 忽略面试者自己的语音（转写中已在进 AI 前剔除自己的内容，避免自习自答）

## 回答要求
- 先点明面试官真正在考什么（考察点）
- 再给出简洁可照说的作答建议
- 针对性强，语气自然，适合面试场景
- 重点关注技术问题和面试相关问题
- 避免重复回答已处理过的问题`
}

/**
 * 兼容旧引用：默认以"使用者=面试者"构建提示词（AI 扮演面试官辅助作答）。
 * @deprecated 请使用 buildSystemPrompt(role)
 */
export const STABLE_SYSTEM_PROMPT = buildSystemPrompt('interviewee')

/**
 * 自动说话人分类器
 *
 * 目标：自动判定"谁是面试官（提问方）"，无需用户手动设置"我是哪一方说话人"。
 *
 * 信号来源（双通道，无额外 API 成本）：
 * 1. **提问特征分（冷启动）**：面试官=提问方、面试者=回答方。每条消息按内容
 *    累加"提问特征分"，谁累计分高判定为面试官。因为面试中提问方几乎总是
 *    面试官，这条启发式一开始就能给出较准的判定。
 * 2. **AI 正反馈闭环（决定性校准）**：AI 每次成功响应，都证明"被送进 AI 的
 *    那一方"确实是面试官（提问方）——给该方大幅加分，进一步固化判定。
 *
 * 考虑到讯飞 rl 在极少数情况下可能中途互换说话人标签，分类器在每次 observe
 * 后都会重算，因此能跟随真实情况自动收敛/修正。
 */
export class SpeakerClassifier {
  // 各说话人累计的"提问特征分"
  private scores: Record<MeetingMessage['role'], number> = { user: 0, asker: 0 }
  // 观测总条数
  private observed = 0
  // 缓存当前判定，避免频繁计算
  private _interviewerRole: MeetingMessage['role'] | null = null

  /** 最小观测条数，少于则暂不判定（避免冷启动误判） */
  private static readonly MIN_OBSERVE = 2
  /** 判定为领先所需的最小分差 */
  private static readonly MIN_LEAD = 1

  private readonly isQuestionContent = (text: string): boolean => {
    if (!text) return false
    return /[?？]/.test(text)
      || /(什么|怎么|为什么|如何|哪|几|多少|能否|是否|可以|能不能|请|说说|谈谈|介绍一下|你是|你觉得|你认为|知道|了解|平时|平时用|用过|有[没有]?用过)\S*[吗呢吧]?|嗯|那|接着|接下来|我们先/.test(text)
  }

  /** 计算单条消息的提问特征分（0~3） */
  private scoreMessage(msg: Pick<MeetingMessage, 'role' | 'content'>): number {
    const t = (msg.content || '').trim()
    if (!t) return 0
    let s = 0
    // 问号：强信号
    if (/[?？]/.test(t)) s += 2
    // 疑问词：中强信号
    if (/(什么|怎么|为什么|如何|哪|几|多少|能否|是否|能不能)/.test(t)) s += 1.5
    // 邀请/过渡句式：面试官开场常用
    if (/(请|可以说说|谈谈|介绍一下|说说|你觉得|你认为|嗯，?那|那.*(呢|吧|么)|接下来|我们先)/.test(t)) s += 1
    // 句末疑问助词
    if (/(吗|呢|吧)$/.test(t)) s += 1
    // 长度惩罚：超长内容更可能是陈述/回答而非提问
    if (t.length > 60) s -= 1
    return s
  }

  /**
   * 喂入一条转写消息，更新分类统计。
   * @param msg 消息（需要 role 与 content）
   * @returns 当前判定出的面试官 role（可能为 null）
   */
  observe(msg: Pick<MeetingMessage, 'role' | 'content'>): MeetingMessage['role'] | null {
    const s = this.scoreMessage(msg)
    if (s > 0) {
      this.scores[msg.role] += s
    }
    this.observed++
    this.recompute()
    return this._interviewerRole
  }

  /**
   * AI 成功响应后的正反馈：认可"当前被送进 AI 的那一方"确实是面试官。
   * @param role 被送进 AI 的说话人（当前判定的 interviewerRole）
   */
  confirm(role: MeetingMessage['role']): MeetingMessage['role'] | null {
    // 大幅加分：AI 一次成功响应是极强的"这一方在提问"证据
    this.scores[role] += 3
    this.recompute()
    return this._interviewerRole
  }

  private recompute(): void {
    if (this.observed < SpeakerClassifier.MIN_OBSERVE) {
      this._interviewerRole = null
      return
    }
    const diff = Math.abs(this.scores.user - this.scores.asker)
    if (diff < SpeakerClassifier.MIN_LEAD) {
      // 分差过小，暂不锁定，继续观察
      return
    }
    this._interviewerRole = this.scores.user > this.scores.asker ? 'user' : 'asker'
  }

  /** 当前判定的面试官 role（可能为 null，表示尚未判定） */
  get interviewerRole(): MeetingMessage['role'] | null {
    return this._interviewerRole
  }

  /** 重置分类器（面试结束/新面试时调用） */
  reset(): void {
    this.scores = { user: 0, asker: 0 }
    this.observed = 0
    this._interviewerRole = null
  }
}

// 全局单例分类器
export const speakerClassifier = new SpeakerClassifier()

/**
 * 为DeepSeek API准备消息，优化KV Cache命中率，并按自动判定的说话人剔除/标记。
 *
 * 功能：
 * 1. **（③）强标记**：保留的消息标记为面试官提问（[面试官]），而非简单当成 user。
 * 2. **（②）剔除**：根据自动分类器判定的面试官方，保留"面试官"的语音作为问题来源，
 *    剔除"面试者"（通常是自己）的语音，避免 AI 自习自答。
 *
 * 说明：若分类器尚未判定出面试官（冷启动阶段，观测不足），则退化为"不过滤"，
 * 以免一开始就丢消息；一旦判定收敛即开始剔除与标记。
 *
 * @param messages 所有消息
 * @param options 可选参数
 * @param options.role 使用者身份（interviewer=面试官 / interviewee=面试者），默认 'interviewee'
 * @returns 准备好的AI消息和新消息ID列表
 */
export const prepareMessagesForAI = (
  messages: MeetingMessage[],
  options?: {
    role?: 'interviewer' | 'interviewee'
  }
) => {
  const role = options?.role ?? 'interviewee'

  const recentMessages = getRecentMessages(messages)
  const interviewerRole = speakerClassifier.interviewerRole

  // ②剔除：若已判定出面试官方，只保留面试官的语音；否则（冷启动）不过滤，避免丢消息
  const filtered = interviewerRole
    ? recentMessages.filter(m => m.role === interviewerRole)
    : recentMessages

  // 在候选消息中，再区分已问过的（历史，作为稳定前缀）和新消息（追加）
  const askedMessages = filtered.filter(m => m.isAsked)
  const newMessages = filtered.filter(m => !m.isAsked)

  // 如果没有新消息，直接返回
  if (newMessages.length === 0) {
    return { aiMessages: [], newMessageIds: [] }
  }

  // 构建稳定的前缀（system prompt + 历史消息）
  const stablePrefix = [
    {
      role: 'system' as const,
      content: buildSystemPrompt(role)
    }
  ]

  // 已处理的历史消息作为稳定前缀（按时间戳排序保持稳定）
  const sortedAskedMessages = askedMessages
    .sort((a, b) => a.timestamp - b.timestamp)
    .map(m => ({
      role: 'user' as const,
      content: interviewerRole
        ? `[历史] [面试官] ${m.content}`
        : `[历史] ${m.content}`
    }))

  // 新消息追加在后面（按时间戳排序）
  const sortedNewMessages = newMessages
    .sort((a, b) => a.timestamp - b.timestamp)
    .map(m => ({
      role: 'user' as const,
      content: interviewerRole
        ? `[新消息] [面试官] ${m.content}`
        : `[新消息] ${m.content}`
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