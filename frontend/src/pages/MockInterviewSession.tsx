import React, { useEffect, useRef, useState, useCallback } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { Button, Typography, message, Spin, Space } from 'antd'
import { getMockSession, streamMockRespond } from '../api/mockInterview'
import type { MockSession, MockMessage } from '../api/mockInterview'
import { createRtasrWebSocket, parseRtasrResult } from '../api/xfyunRtasr'
import RecorderManager from '../api/utils/xfyunRtasr/index.esm.js'
import { isAudioActive } from '../utils/voiceIdentifier'

const { Title, Text } = Typography

// 中文数字归一化：把中文字符表示的数字统一转成阿拉伯数字，
// 使「十一月/11月、五个/5个、三千两百/3200」在回音比对时能对齐
const _cnDigit: Record<string, number> = { 零: 0, 一: 1, 二: 2, 两: 2, 三: 3, 四: 4, 五: 5, 六: 6, 七: 7, 八: 8, 九: 9 }
const _cnUnit: Record<string, number> = { 十: 10, 百: 100, 千: 1000, 万: 10000, 亿: 100000000 }
const _parseCnNumber = (s: string): number => {
  let total = 0, section = 0, number = 0
  for (const ch of s) {
    if (ch === '零') continue
    else if (_cnDigit[ch] !== undefined) number = _cnDigit[ch]
    else if (_cnUnit[ch] !== undefined) {
      const u = _cnUnit[ch]
      if (u === 10000 || u === 100000000) {
        section = (section + number) * u
        total += section
        section = 0
        number = 0
      } else {
        section += (number || 1) * u
        number = 0
      }
    }
  }
  return total + section + number
}
const _normalizeNumbers = (text: string): string =>
  text.replace(/[零一二两三四五六七八九十百千万亿]+/g, (m) => {
    if (m.length === 1 && _cnDigit[m] !== undefined) return String(_cnDigit[m])
    const v = _parseCnNumber(m)
    return Number.isNaN(v) ? m : String(v)
  })

const MockInterviewSession: React.FC = () => {
  const { sessionId = '' } = useParams<{ sessionId: string }>()
  const navigate = useNavigate()

  const [session, setSession] = useState<MockSession | null>(null)
  const [messages, setMessages] = useState<MockMessage[]>([])
  const [recording, setRecording] = useState(false)
  const [audioActive, setAudioActive] = useState(false)
  const [thinking, setThinking] = useState(false)      // AI 是否在思考/输出
  const [currentAi, setCurrentAi] = useState('')       // 当前正在流的 AI 回答
  const [error, setError] = useState('')

  const wsRef = useRef<WebSocket | null>(null)
  const recorderRef = useRef<any>(null)
  const silenceTimerRef = useRef<number | null>(null)
  const lastSilentTriggerRef = useRef(0)  // 上次已触发作答的时刻（防重复）
  const activeMessageRef = useRef('')     // 当前累积的面试官语句
  const abortRef = useRef<{ abort: () => void } | null>(null)
  const msgBufRef = useRef<MockMessage[]>([])
  const xfyunSessionIdRef = useRef('')    // 讯飞实时转写会话ID（用于结束标识）
  const scrollRef = useRef<HTMLDivElement | null>(null)  // 聊天滚动容器
  const thinkingRef = useRef(false)       // AI 是否正在输出的镜像（供回调读取）
  const aiFinishedAtRef = useRef(0)       // AI 最近一次结束输出的时刻（用于冷却窗口）
  const lastAiContentsRef = useRef<string[]>([])  // 最近几条 AI 回答内容（用于回音去重）

  // 加载会话
  useEffect(() => {
    let mounted = true
    getMockSession(sessionId).then((s) => {
      if (!mounted) return
      setSession(s)
      setMessages(s.messages || [])
      msgBufRef.current = s.messages || []
    }).catch(() => {
      message.error('模拟面试会话加载失败')
      navigate('/mock-interview')
    })
    return () => { mounted = false }
  }, [sessionId, navigate])

  // 消息或流式回答变化时，自动滚动到底部
  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' })
  }, [messages, currentAi, thinking])

  const appendMsg = (m: MockMessage) => {
    msgBufRef.current = [...msgBufRef.current, m]
    setMessages(msgBufRef.current)
  }

  // 触发 AI 面试者作答
  const triggerAi = useCallback((interviewerText: string) => {
    if (thinkingRef.current) return
    thinkingRef.current = true
    setThinking(true)
    setError('')
    setCurrentAi('')
    let acc = ''
    abortRef.current?.abort?.()
    abortRef.current = streamMockRespond(sessionId, interviewerText, {
      onDelta: (t) => { acc += t; setCurrentAi(acc) },
      onError: (e) => setError(e),
      onDone: () => {
        // 本地追加一条 AI 消息展示
        appendMsg({ id: Date.now(), role: 'ai', content: acc, created_at: new Date().toISOString() })
        // 记录这条 AI 回答，供后续转写内容做回音去重（只保留最近几条）
        const normalized = acc.replace(/\s+/g, '').toLowerCase()
        if (normalized) {
          lastAiContentsRef.current = [...lastAiContentsRef.current, normalized].slice(-3)
        }
        thinkingRef.current = false
        aiFinishedAtRef.current = Date.now()
        setThinking(false)
        setCurrentAi('')
      },
    }, 10)
  }, [sessionId])

  // 是否为「朗读 AI 回答」的回音：判断转写内容与最近某条 AI 回答足够相似
  // 使用 n-gram（3字窗口）集合相似度 + 中文数字归一化，对 ASR 错字/多字/数字写法差异更鲁棒
  const isEchoOfAi = useCallback((text: string): boolean => {
    const t = _normalizeNumbers(text.replace(/\s+/g, '').toLowerCase())
    if (t.length < 8) return false  // 太短不足以可靠判断
    for (const rawAi of lastAiContentsRef.current) {
      const ai = _normalizeNumbers(rawAi.replace(/\s+/g, '').toLowerCase())
      if (!ai || ai.length < 8) continue
      const [small, big] = t.length <= ai.length ? [t, ai] : [ai, t]

      const bigSet = new Set<string>()
      for (let i = 0; i + 3 <= big.length; i++) bigSet.add(big.slice(i, i + 3))

      let hits = 0, total = 0
      for (let i = 0; i + 3 <= small.length; i++) {
        total++
        if (bigSet.has(small.slice(i, i + 3))) hits++
      }
      if (total === 0) continue

      const ratio = hits / total
      // 转写是 AI 回答的照读时（即使 ASR 有错字、数字写法不同），
      // 绝大多数 3-gram 仍能命中，比例较高则判定为回音
      if (ratio >= 0.5) return true
    }
    return false
  }, [])

  // 面试官（使用者）说完停顿检测触发
  const onSilence = useCallback((text: string) => {
    const t = text.trim()
    if (!t) return
    const now = Date.now()
    // 防抖：5 秒内不重复触发
    if (now - lastSilentTriggerRef.current < 5000) return

    // 回音去重：转写内容与最近 AI 回答高度重合（用户在朗读 AI 生成的回答）则丢弃，
    // 避免把 AI 说出的内容又当成面试官输入，形成循环
    const echo = isEchoOfAi(t)
    if (echo) {
      // 丢弃回音，但仍消耗一次触发名额，避免紧接着又被同段回音触发
      lastSilentTriggerRef.current = now
      activeMessageRef.current = ''
      return
    }

    lastSilentTriggerRef.current = now
    appendMsg({ id: Date.now(), role: 'interviewer', content: t, created_at: new Date().toISOString() })
    triggerAi(t)
  }, [triggerAi, isEchoOfAi])

  // 解析转写结果：累积面试官说话内容，停顿(约2.5s)后触发作答
  const handleRtasrResult = useCallback((data: any) => {
    // 错误或非结果消息直接忽略
    if (data?.action === 'error') {
      console.error('讯飞转写错误:', data?.code, data?.desc)
      return
    }
    // 兼容新版接口：action 为 result（或缺失）且 code 为 0 / '0'/ 正常帧时处理
    if (data?.action && data.action !== 'result') return
    if (data?.code && String(data.code) !== '0') return

    let parsed: any = data?.data
    if (typeof parsed === 'string') {
      try {
        parsed = parsed ? JSON.parse(parsed) : null
      } catch {
        return
      }
    }
    if (!parsed) return
    const chunks = parseRtasrResult(parsed)
    if (!chunks.length) return

    const text = chunks.map(c => c.content).join('')

    // AI 正在输出时，麦克风很可能在采集朗读出来的 AI 回答，
    // 直接丢弃该段转写，避免污染面试官输入
    if (thinkingRef.current) return

    // AI 刚结束输出后的冷却窗口（约 4 秒）内丢弃转写，
    // 吸收朗读回答尾音的残留
    if (Date.now() - aiFinishedAtRef.current < 4000) return

    activeMessageRef.current += text

    // 每次有新转写都重置"停顿计时"
    if (silenceTimerRef.current) {
      window.clearTimeout(silenceTimerRef.current)
      silenceTimerRef.current = null
    }
    // 停顿 2500ms 认为面试官问完 -> 触发 AI 作答（面试官停顿时不超过5s等待）
    silenceTimerRef.current = window.setTimeout(() => {
      const msg = activeMessageRef.current
      activeMessageRef.current = ''
      if (msg.trim()) onSilence(msg)
      silenceTimerRef.current = null
    }, 2500)
  }, [onSilence])

  const handleStart = async () => {
    setRecording(true)
    // 为本次实时转写会话生成唯一ID，用于结束标识
    if (!xfyunSessionIdRef.current) {
      xfyunSessionIdRef.current = `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`
    }
    const recorder = new RecorderManager('/xfyunRtasr')
    recorderRef.current = recorder
    const ws = createRtasrWebSocket({
      onResult: handleRtasrResult,
      onError: () => setRecording(false),
      onClose: () => setRecording(false),
      onOpen: async () => {
        recorder.onFrameRecorded = ({ isLastFrame, frameBuffer }: any) => {
          const a = isAudioActive(frameBuffer, 0.02)
          setAudioActive(a)
          if (ws.readyState === ws.OPEN) {
            ws.send(new Int8Array(frameBuffer))
          }
        }
        await recorder.start({ sampleRate: 16000, frameSize: 1280 })
      },
    })
    wsRef.current = ws
  }

  const handleStop = () => {
    setRecording(false)
    recorderRef.current?.stop()
    // 新版接口：先发送结束标识，让服务端返回最终结果
    const ws = wsRef.current
    if (ws && ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify({ end: true, sessionId: xfyunSessionIdRef.current }))
    }
    // 短暂等待最终结果后关闭连接
    setTimeout(() => {
      wsRef.current?.close()
    }, 2000)
    abortRef.current?.abort?.()
    if (silenceTimerRef.current) { window.clearTimeout(silenceTimerRef.current); silenceTimerRef.current = null }
  }

  useEffect(() => () => {
    recorderRef.current?.stop?.()
    wsRef.current?.close?.()
    abortRef.current?.abort?.()
    if (silenceTimerRef.current) { window.clearTimeout(silenceTimerRef.current) }
  }, [])

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100vh', background: '#fff', color: '#1f1f1f' }}>
      {/* 顶部栏 */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px 24px', borderBottom: '1px solid #eee' }}>
        <Title level={4} style={{ margin: 0 }}>模拟面试（AI 面试者）</Title>
        <Space>
          <Button onClick={() => navigate('/mock-interview')}>返回配置</Button>
          <Button type={recording ? 'danger' : 'primary'} onClick={recording ? handleStop : handleStart}>
            {recording ? '停止' : '开始录音'}
          </Button>
        </Space>
      </div>

      {/* 主内容 */}
      <div ref={scrollRef} style={{ flex: 1, overflowY: 'auto', padding: 24, display: 'flex', flexDirection: 'column', gap: 12 }}>
        {messages.map((m) => (
          <div key={m.id} style={{ display: 'flex', flexDirection: 'column', alignItems: m.role === 'interviewer' ? 'flex-start' : 'flex-end' }}>
            <div style={{ fontSize: 12, color: '#999', marginBottom: 4 }}>
              {m.role === 'interviewer' ? '面试官（你）' : 'AI 面试者'}
            </div>
            <div style={{
              maxWidth: '70%', padding: '10px 14px', borderRadius: 8,
              background: m.role === 'interviewer' ? '#f5f5f5' : '#e6f7ff',
              color: '#1f1f1f',
            }}>
              {m.content}
            </div>
          </div>
        ))}

        {/* 当前流式 AI 回答 */}
        {thinking && (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end' }}>
            <div style={{ fontSize: 12, color: '#999', marginBottom: 4 }}>AI 面试者（思考中...）</div>
            <div style={{ maxWidth: '70%', padding: '10px 14px', borderRadius: 8, background: '#e6f7ff', color: '#1f1f1f' }}>
              {currentAi || <Spin size="small" />}
            </div>
          </div>
        )}

        {error && <Text type="danger">错误：{error}</Text>}
      </div>

      {/* 底部状态栏 */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 16, padding: '12px 24px', borderTop: '1px solid #eee' }}>
        <div style={{ width: 12, height: 12, borderRadius: '50%', background: recording ? (audioActive ? '#52c41a' : '#ff4d4f') : '#d9d9d9' }} />
        <Text type="secondary">{recording ? (audioActive ? '收音中' : '静音中') : '未录音'}</Text>
        {thinking && <Spin size="small" />}
        <Text type="secondary">水平：{session?.level || '-'}</Text>
      </div>
    </div>
  )
}

export default MockInterviewSession
