import React, { useEffect, useRef, useState, useCallback } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { Button, Typography, message, Spin, Space } from 'antd'
import { getMockSession, streamMockRespond, MockSession, MockMessage } from '../api/mockInterview'
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
    if (data?.action !== 'result' || data?.code !== '0') return
    const parsed = typeof data.data === 'string' ? JSON.parse(data.data) : data.data
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
    wsRef.current?.close()
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
    <div style={{ display: 'flex', flexDirection: 'column', height: '100vh', background: '#fff' }}>
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
            }}>
              {m.content}
            </div>
          </div>
        ))}

        {/* 当前流式 AI 回答 */}
        {thinking && (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end' }}>
            <div style={{ fontSize: 12, color: '#999', marginBottom: 4 }}>AI 面试者（思考中...）</div>
            <div style={{ maxWidth: '70%', padding: '10px 14px', borderRadius: 8, background: '#e6f7ff' }}>
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
