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

// 回音判定时保留的滚动缓冲长度（字符）。跨停顿累计，避免慢读短片段漏判。
const ECHO_BUF_CAP = 120
// 转写间隔超过该时长视为「新的一段话」，重置回音缓冲（避免吞掉随后的真实问题）
const ECHO_GAP_RESET_MS = 3500
// 长度自适应阈值：长片段（>=15字，符合"朗读照读"的特征）用低阈值；
// 短片段用高阈值，避免把「重叠怎么处理」这类短真实提问误判为回音。
const ECHO_LONG_LEN = 15
const ECHO_THR_LONG_ENTER = 0.42
const ECHO_THR_LONG_STAY = 0.32
const ECHO_THR_SHORT_ENTER = 0.70
const ECHO_THR_SHORT_STAY = 0.60
// 含疑问词的文本更可能是真实提问，提高阈值（回音是陈述片段，通常不含疑问词）
const ECHO_Q_BONUS = 0.15
const Q_MARKERS = /[吗呢嘛]|什么|怎么|为什么|如何|多少|哪|是否|能不能|会不会|有没有|可不可以|多久|几个/

// 回音比对用的归一化：去空白/标点/符号，转小写，统一中文数字
const _normEchoText = (s: string): string =>
  _normalizeNumbers(s.replace(/[\s\p{P}\p{S}]/gu, '').toLowerCase())

// 调试日志开关的本地存储键
const DEBUG_LS_KEY = 'mockInterviewDebug'

interface DebugEntry {
  ts: number          // 时间戳
  t: number           // 相对会话开始的毫秒
  event: string       // 事件：decision（note 为 echo/question/dupSkip）、gapReset、aiDone
  seg?: string        // 本段转写原文
  buf?: string        // 参与比对的滚动缓冲
  score?: number      // 相似度分数
  threshold?: number  // 本次使用的阈值
  echoState?: boolean // 判定前的滞回状态
  note?: string       // 备注：echo/question/dupSkip/gapReset/aiDone
}

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
  const echoBufRef = useRef('')           // 跨停顿累计的转写缓冲（回音判定用）
  const echoStateRef = useRef(false)      // 是否处于「回音态」（滞回用）
  const lastChunkAtRef = useRef(0)        // 最近一次收到转写的时刻（用于话语段边界重置）

  // ---- 调试日志 ----
  const [debugOn, setDebugOn] = useState<boolean>(() => {
    try { return localStorage.getItem(DEBUG_LS_KEY) === '1' } catch { return false }
  })
  const [debugCount, setDebugCount] = useState(0)
  const debugOnRef = useRef(debugOn)
  const debugLogRef = useRef<DebugEntry[]>([])
  const debugStartRef = useRef(Date.now())
  const aiRawRef = useRef<string[]>([])   // 原始 AI 回答（供导出对照标注）

  useEffect(() => {
    debugOnRef.current = debugOn
    try { localStorage.setItem(DEBUG_LS_KEY, debugOn ? '1' : '0') } catch { /* ignore */ }
  }, [debugOn])

  const logDebug = useCallback((e: Omit<DebugEntry, 'ts' | 't'>) => {
    if (!debugOnRef.current) return
    const now = Date.now()
    debugLogRef.current.push({ ...e, ts: now, t: now - debugStartRef.current })
    // 只保留最近 3000 条，避免内存无限增长
    if (debugLogRef.current.length > 3000) debugLogRef.current.splice(0, debugLogRef.current.length - 3000)
    setDebugCount(debugLogRef.current.length)
  }, [])

  const exportDebug = useCallback(() => {
    const data = {
      exportedAt: new Date().toISOString(),
      sessionId,
      thresholds: {
        longLen: ECHO_LONG_LEN,
        longEnter: ECHO_THR_LONG_ENTER, longStay: ECHO_THR_LONG_STAY,
        shortEnter: ECHO_THR_SHORT_ENTER, shortStay: ECHO_THR_SHORT_STAY,
        questionBonus: ECHO_Q_BONUS,
        bufCap: ECHO_BUF_CAP, gapResetMs: ECHO_GAP_RESET_MS,
      },
      aiAnswersNormalized: lastAiContentsRef.current,
      aiAnswersRaw: aiRawRef.current,
      entries: debugLogRef.current,
    }
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `mock-interview-debug-${Date.now()}.json`
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)
  }, [sessionId])

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
        aiRawRef.current = [...aiRawRef.current, acc].slice(-5)
        thinkingRef.current = false
        aiFinishedAtRef.current = Date.now()
        // AI 结束时清空累积缓冲，避免 AI 最后一句的扬声器尾音残留累积后触发假问题。
        // 面试官之后重新开口的问题会重新累积，不受影响。
        activeMessageRef.current = ''
        echoBufRef.current = ''
        echoStateRef.current = false
        logDebug({ event: 'aiDone', note: `回答长度=${acc.length}`, seg: acc.slice(0, 40) })
        setThinking(false)
        setCurrentAi('')
      },
    }, 10)
  }, [sessionId, logDebug])

  // 计算「最近转录文本」与「最近 AI 回答」的最大相似度（0~1）。
  // 用 bigram(0.6) + trigram(0.4) 加权：bigram 对 ASR 错字/多字更鲁棒。
  const echoScoreOf = useCallback((buf: string): number => {
    const t = _normEchoText(buf)
    if (t.length < 3) return 0
    let best = 0
    for (const rawAi of lastAiContentsRef.current) {
      const ai = _normEchoText(rawAi)
      if (!ai || ai.length < 4) continue
      let b2 = 0, t3 = 0
      // bigram
      {
        const set = new Set<string>()
        for (let i = 0; i + 2 <= ai.length; i++) set.add(ai.slice(i, i + 2))
        let h = 0, tot = 0
        for (let i = 0; i + 2 <= t.length; i++) { tot++; if (set.has(t.slice(i, i + 2))) h++ }
        b2 = tot ? h / tot : 0
      }
      // trigram
      {
        const set = new Set<string>()
        for (let i = 0; i + 3 <= ai.length; i++) set.add(ai.slice(i, i + 3))
        let h = 0, tot = 0
        for (let i = 0; i + 3 <= t.length; i++) { tot++; if (set.has(t.slice(i, i + 3))) h++ }
        t3 = tot ? h / tot : 0
      }
      const s = 0.6 * b2 + 0.4 * t3
      if (s > best) best = s
    }
    return best
  }, [])

  // 面试官（使用者）说完停顿检测触发
  const onSilence = useCallback((text: string) => {
    const t = text.trim()
    if (!t) return
    const now = Date.now()

    // 1) 回音判定：把本段并入「滚动累计缓冲」后整体比对，解决慢读时
    //    单个停顿片段太短（<8字）无法判定而漏网的问题。
    //    注意：回音检测必须先于防抖执行，否则朗读片段会被防抖逻辑悄悄放行。
    echoBufRef.current = (echoBufRef.current + t).slice(-ECHO_BUF_CAP)
    const s = echoScoreOf(echoBufRef.current)
    const wasEcho = echoStateRef.current
    // 长度自适应阈值：
    //  - 长片段（>=15字）符合"朗读照读"特征，用低阈值拦截；
    //  - 短片段用高阈值，避免「重叠怎么处理」这类短真实提问被误判；
    //  - 含疑问词的文本再抬高阈值（回音是陈述片段，通常不含疑问词）；
    //  - 滞回：已在回音态时阈值再降 0.1，避免朗读中零星片段漏出。
    const bufLen = _normEchoText(echoBufRef.current).length
    const isLong = bufLen >= ECHO_LONG_LEN
    const baseThr = isLong
      ? (wasEcho ? ECHO_THR_LONG_STAY : ECHO_THR_LONG_ENTER)
      : (wasEcho ? ECHO_THR_SHORT_STAY : ECHO_THR_SHORT_ENTER)
    const threshold = baseThr + (Q_MARKERS.test(t) ? ECHO_Q_BONUS : 0)
    if (s >= threshold) {
      echoStateRef.current = true
      activeMessageRef.current = ''
      logDebug({ event: 'decision', seg: t, buf: echoBufRef.current, score: Number(s.toFixed(4)), threshold, echoState: wasEcho, note: `echo len=${bufLen}` })
      // 保留较长的尾巴，保证朗读片段的相似度判定能连续命中
      echoBufRef.current = echoBufRef.current.slice(-100)
      return
    }

    // 2) 真实问题：防抖只用于避免同一句话被重复触发，不再吞掉真实提问
    echoStateRef.current = false
    echoBufRef.current = ''
    if (now - lastSilentTriggerRef.current < 1500) {
      logDebug({ event: 'decision', seg: t, score: Number(s.toFixed(4)), threshold, echoState: wasEcho, note: `dupSkip len=${bufLen}` })
      return
    }
    logDebug({ event: 'decision', seg: t, score: Number(s.toFixed(4)), threshold, echoState: wasEcho, note: `question len=${bufLen}` })
    lastSilentTriggerRef.current = now
    appendMsg({ id: Date.now(), role: 'interviewer', content: t, created_at: new Date().toISOString() })
    triggerAi(t)
  }, [triggerAi, echoScoreOf, logDebug])

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

    // AI 刚结束输出后的短冷却窗（约 1 秒），仅吸收 AI 最后一句在扬声器播放的尾音延迟。
    // 长段的朗读回音不靠时间窗处理（会误杀面试官紧接着问的真实问题），
    // 交给 onSilence 里的内容相似度过滤（echoScoreOf）去识别。
    if (Date.now() - aiFinishedAtRef.current < 1000) return

    // 话语段边界：距上一次转写超过 3.5 秒，视为新的一段话（用户思考后重新开口）。
    // 重置回音累计缓冲，避免上一段朗读的残留把随后真实问题一起吞掉。
    const nowMs = Date.now()
    if (nowMs - lastChunkAtRef.current > ECHO_GAP_RESET_MS) {
      // 记录上一段缓冲，便于事后分析是否误吞了真实问题
      if (echoBufRef.current) logDebug({ event: 'gapReset', buf: echoBufRef.current, note: `间隔=${nowMs - lastChunkAtRef.current}ms` })
      echoBufRef.current = ''
      echoStateRef.current = false
    }
    lastChunkAtRef.current = nowMs

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
  }, [onSilence, logDebug])

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
    // 停止录音时清空回音判定状态
    echoBufRef.current = ''
    echoStateRef.current = false
    lastChunkAtRef.current = 0
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

        {/* 调试日志开关与导出 */}
        <span style={{ marginLeft: 'auto', display: 'inline-flex', alignItems: 'center', gap: 8 }}>
          <button
            onClick={() => setDebugOn(v => !v)}
            style={{
              fontSize: 12, padding: '4px 10px', borderRadius: 6, cursor: 'pointer',
              border: '1px solid ' + (debugOn ? '#1677ff' : '#d9d9d9'),
              background: debugOn ? '#e6f4ff' : '#fff',
              color: debugOn ? '#1677ff' : '#666',
            }}
          >
            调试日志：{debugOn ? '开' : '关'}{debugOn ? `（${debugCount}）` : ''}
          </button>
          {debugOn && (
            <>
              <button onClick={exportDebug} style={{ fontSize: 12, padding: '4px 10px', borderRadius: 6, cursor: 'pointer', border: '1px solid #1677ff', background: '#1677ff', color: '#fff' }}>
                导出 JSON
              </button>
              <button
                onClick={() => { debugLogRef.current = []; setDebugCount(0) }}
                style={{ fontSize: 12, padding: '4px 10px', borderRadius: 6, cursor: 'pointer', border: '1px solid #d9d9d9', background: '#fff', color: '#666' }}
              >
                清空
              </button>
            </>
          )}
        </span>
      </div>
    </div>
  )
}

export default MockInterviewSession
