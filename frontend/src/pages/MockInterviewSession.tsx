import React, { useEffect, useRef, useState, useCallback } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { Button, Typography, message, Spin, Space } from 'antd'
import { getMockSession, streamMockRespond } from '../api/mockInterview'
import type { MockSession, MockMessage } from '../api/mockInterview'
import { createRtasrWebSocket, parseRtasrResult } from '../api/xfyunRtasr'
import RecorderManager from '../api/utils/xfyunRtasr/index.esm.js'
import { isAudioActive } from '../utils/voiceIdentifier'

const { Title, Text } = Typography

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

  const appendMsg = (m: MockMessage) => {
    msgBufRef.current = [...msgBufRef.current, m]
    setMessages(msgBufRef.current)
  }

  // 触发 AI 面试者作答
  const triggerAi = useCallback((interviewerText: string) => {
    if (thinking) return
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
        setThinking(false)
        setCurrentAi('')
      },
    }, 10)
  }, [sessionId, thinking])

  // 面试官（使用者）说完停顿检测触发
  const onSilence = useCallback((text: string) => {
    const t = text.trim()
    if (!t) return
    const now = Date.now()
    // 防抖：5 秒内不重复触发
    if (now - lastSilentTriggerRef.current < 5000) return
    lastSilentTriggerRef.current = now
    appendMsg({ id: Date.now(), role: 'interviewer', content: t, created_at: new Date().toISOString() })
    triggerAi(t)
  }, [triggerAi])

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
      <div style={{ flex: 1, overflowY: 'auto', padding: 24, display: 'flex', flexDirection: 'column', gap: 12 }}>
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
