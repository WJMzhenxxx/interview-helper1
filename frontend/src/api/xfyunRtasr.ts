// 科大讯飞实时语音转写API工具
// 文档参考：https://www.xfyun.cn/doc/asr/rtasr/API.html

import CryptoJS from 'crypto-js';
import type { MeetingMessage } from '@/store/interviewStore'
import { useInterviewStore } from '@/store/interviewStore'
import { useXfyunConfigStore } from '@/store/xfyunConfigStore'

// 获取当前时间戳（秒）
function getTimestamp() {
  return Math.floor(Date.now() / 1000);
}

// 生成 signa（HMACSHA1 + base64 + urlencode）
function getSigna(appid: string, apiKey: string, ts: number) {
  const signa = CryptoJS.MD5(appid + ts).toString();
  const signatureSha = CryptoJS.HmacSHA1(signa, apiKey);
  const signature = CryptoJS.enc.Base64.stringify(signatureSha);
  return encodeURIComponent(signature);
}

// 生成WebSocket URL
export function getRtasrWebSocketUrl() {
  const { getAppId, getApiKey } = useXfyunConfigStore.getState();
  const appId = getAppId();
  const apiKey = getApiKey();
  
  if (!appId || !apiKey) {
    throw new Error('科大讯飞API配置未完成，请在设置中配置APPID和API_KEY');
  }
  
  const ts = getTimestamp();
  const signa = getSigna(appId, apiKey, ts);
  return `wss://rtasr.xfyun.cn/v1/ws?appid=${appId}&ts=${ts}&signa=${signa}&roleType=2`;
}

// 创建WebSocket并处理转写
export function createRtasrWebSocket({
  onResult,
  onError,
  onOpen,
  onClose
}: {
  onResult: (data: any) => void,
  onError?: (e: Event) => void,
  onOpen?: () => void,
  onClose?: () => void
}) {
  const ws = new WebSocket(getRtasrWebSocketUrl());
  ws.onopen = () => {
    onOpen && onOpen();
  };
  ws.onmessage = (e) => {
    try {
      const json = JSON.parse(e.data);
      onResult(json);
    } catch (err) {
      // 忽略非JSON消息
    }
  };
  ws.onerror = (e) => {
    onError && onError(e);
  };
  ws.onclose = () => {
    onClose && onClose();
  };
  return ws;
}

// 全局状态：防抖器和数据追踪
let questionDetectionDebouncer: any = null
let lastDataReceiveTime = Date.now()
let currentAudioActive = false
let currentQuestionDetectionCallback: (() => void) | null = null
let silenceCheckTimer: number | null = null

/**
 * 清理问题检测相关资源
 */
export function cleanupQuestionDetection() {
  if (silenceCheckTimer) {
    window.clearTimeout(silenceCheckTimer)
    silenceCheckTimer = null
  }
  currentQuestionDetectionCallback = null
  
  if (questionDetectionDebouncer) {
    questionDetectionDebouncer.destroy?.()
    questionDetectionDebouncer = null
  }
}

// 初始化防抖器（延迟加载以避免循环依赖）
async function initDebouncer() {
  if (!questionDetectionDebouncer) {
    const { QuestionDetectionDebouncer } = await import('@/utils/questionDetection')
    questionDetectionDebouncer = new QuestionDetectionDebouncer(500)
  }
  return questionDetectionDebouncer
}

/**
 * 设置音频活跃状态并同步到问题检测系统
 * @param audioActive 音频是否活跃
 */
export async function setAudioActiveState(audioActive: boolean) {
  currentAudioActive = audioActive
  
  // 同步到问题检测系统，追踪静音时间
  const { updateAudioActiveState } = await import('@/utils/questionDetection')
  updateAudioActiveState(audioActive)
  
  // 如果变为静音，启动延迟检查
  if (!audioActive && currentQuestionDetectionCallback) {
    // 清除之前的定时器
    if (silenceCheckTimer) {
      window.clearTimeout(silenceCheckTimer)
    }
    
    // 1.1秒后主动检查一次（绕过预检查）
    silenceCheckTimer = window.setTimeout(() => {
      console.log('🔍 静音1.1秒后主动检查触发条件')
      checkAndTriggerQuestionDetection(currentQuestionDetectionCallback, true) // bypassPreCheck = true
      silenceCheckTimer = null
    }, 1100)
  } else if (audioActive) {
    // 如果重新有声音，取消延迟检查
    if (silenceCheckTimer) {
      window.clearTimeout(silenceCheckTimer)
      silenceCheckTimer = null
    }
  }
}

/**
 * 轻量级预检查：避免过度触发完整检查
 * @param lastDataTime 最后收到数据的时间
 * @returns 是否需要进行完整检查
 */
function shouldPreCheck(lastDataTime: number): boolean {
  const now = Date.now()
  const timeSinceLastData = now - lastDataTime
  
  // 只有在接近触发条件时才进行完整检查
  // 距离3秒数据中断还有500ms以内时才检查
  return timeSinceLastData > 2500
}

/**
 * 智能问题检测触发器
 * @param onQuestionDetection 问题检测回调
 * @param bypassPreCheck 是否绕过预检查（用于主动检查）
 */
async function checkAndTriggerQuestionDetection(onQuestionDetection?: () => void, bypassPreCheck = false) {
  if (!onQuestionDetection) return
  
  // 轻量级预检查，避免过度触发（主动检查可以绕过）
  if (!bypassPreCheck && !shouldPreCheck(lastDataReceiveTime)) {
    return
  }
  
  // 动态导入避免循环依赖
  const { shouldTriggerQuestionDetection } = await import('@/utils/questionDetection')
  
  // 统一的触发检查入口（当前总是返回true，预留未来扩展）
  const shouldTrigger = shouldTriggerQuestionDetection(lastDataReceiveTime)
  
  if (shouldTrigger) {
    const debouncer = await initDebouncer()
    debouncer.debounce(() => {
      const triggerSource = bypassPreCheck ? '主动静音检查' : '被动数据检查'
      console.log(`🎯 触发AI问题检测 - ${triggerSource}`)
      onQuestionDetection()
    })
  }
}

/**
 * 解析科大讯飞实时转写API返回的data字段，转为 MeetingMessage[]，支持智能问题检测
 * @param contentData 科大讯飞ws返回的整体对象
 * @param onQuestionDetected 智能问题检测回调函数
 * @returns MeetingMessage[]
 */
export function parseRtasrResult(contentData: any, onQuestionDetected?: () => void): MeetingMessage[] {
  const result: MeetingMessage[] = []
  
  // 更新数据接收时间
  lastDataReceiveTime = Date.now()
  
  // 设置当前回调，用于延迟主动检查
  if (onQuestionDetected) {
    currentQuestionDetectionCallback = onQuestionDetected
  }
  
  console.info('【parseRtasrResult】', contentData)
  
  try {
    if (!contentData || !contentData.cn || !contentData.cn.st || !contentData.cn.st.rt) {
      console.error('【parseRtasrResult】', 'dataObj is null')
      return result
    }
    
    if (contentData.cn.st.type !== '0') {
      return result
    }
    
    let lastRl: string | null = null
    let currentContent = ''
    let currentRole: 'user' | 'asker' = 'user'
    
    // 解析转写结果
    contentData.cn.st.rt.forEach((rtItem: any) => {
      rtItem.ws.forEach((wsItem: any) => {
        wsItem.cw.forEach((cwItem: any) => {
          const rl = cwItem.rl
          const role: 'user' | 'asker' = rl === '0' ? 'user' : 'asker'
          
          if (lastRl === null) {
            // 第一个
            lastRl = rl
            currentRole = role
            currentContent = cwItem.w
          } else if (rl === lastRl) {
            // 角色未变，继续累积内容
            currentContent += cwItem.w
          } else {
            // 角色切换，先推送上一个消息
            if (currentContent.trim()) {
              const message = {
                id: Date.now().toString() + Math.random(),
                timestamp: Date.now(),
                content: currentContent.trim(),
                role: currentRole,
                status: 'sent' as const,
              }
              result.push(message)
              
              // 每个消息只检查一次触发条件
              checkAndTriggerQuestionDetection(onQuestionDetected)
            }
            
            // 开始新角色的内容
            lastRl = rl
            currentRole = role
            currentContent = cwItem.w
          }
        })
      })
    })
    
    // 推送最后一段内容
    if (currentContent.trim()) {
      const message = {
        id: Date.now().toString() + Math.random(),
        timestamp: Date.now(),
        content: currentContent.trim(),
        role: currentRole,
        status: 'sent' as const,
      }
      result.push(message)
      
      // 对最后一个消息也检查触发条件
      checkAndTriggerQuestionDetection(onQuestionDetected)
    }
    
    return result
    
  } catch (e) {
    console.error('parseRtasrResult error', e)
    return result
  }
} 