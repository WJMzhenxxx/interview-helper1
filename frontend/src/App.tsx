import React from 'react'
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom'
import MainLayout from './layouts/MainLayout'
import InterviewNew from './pages/InterviewNew'
import InterviewMeeting from './pages/InterviewMeeting'
import Settings from './pages/Settings'

const Placeholder: React.FC<{ title: string }> = ({ title }) => (
  <div style={{ padding: 48, textAlign: 'center', fontSize: 24, color: '#888' }}>{title}（开发中...）</div>
)

const App: React.FC = () => {
  return (
    <Router>
      <Routes>
        <Route path="/interview/meeting" element={<InterviewMeeting />} />
        <Route path="/" element={<MainLayout><Placeholder title="首页" /></MainLayout>} />
        <Route path="/interview/new" element={<MainLayout><InterviewNew /></MainLayout>} />
        <Route path="/interview/record" element={<MainLayout><Placeholder title="面试记录" /></MainLayout>} />
        <Route path="/help" element={<MainLayout><Placeholder title="帮助" /></MainLayout>} />
        <Route path="/settings" element={<MainLayout><Settings /></MainLayout>} />
        <Route path="*" element={<Navigate to="/interview/new" replace />} />
      </Routes>
    </Router>
  )
}

export default App
