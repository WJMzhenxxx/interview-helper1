import React, { useState } from 'react'
import { Form, Input, Select, Button, Typography, Divider, Card, message } from 'antd'
import { useNavigate } from 'react-router-dom'
import { createMockSession } from '../api/mockInterview'

const { Title, Text } = Typography
const { TextArea } = Input

const MockInterviewSetup: React.FC = () => {
  const navigate = useNavigate()
  const [submitting, setSubmitting] = useState(false)

  const onFinish = async (values: any) => {
    setSubmitting(true)
    try {
      const session = await createMockSession({
        jd: values.jd || '',
        resume: values.resume || '',
        level: values.level || 'unlimited',
      })
      message.success('模拟面试会话已创建')
      navigate(`/mock-interview/session/${session.session_id}`)
    } catch (e: any) {
      message.error(e?.message || '创建模拟面试失败，请确认已登录')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div style={{ padding: '24px', maxWidth: 760, margin: '0 auto' }}>
      <Title level={2}>模拟面试设置</Title>
      <Text type="secondary">
        配置 AI 面试者的简历与应聘岗位，设定其水平等级，然后点击开始，进入模拟面试。
      </Text>
      <Divider />

      <Form layout="vertical" onFinish={onFinish} initialValues={{ level: 'unlimited' }}>
        <Card title="① 应聘岗位 JD" style={{ marginBottom: 16 }}>
          <Text type="secondary" style={{ display: 'block', marginBottom: 8 }}>
            粘贴这份岗位的职位描述（JD），AI 面试者将据此判断岗位要求。
          </Text>
          <Form.Item name="jd" style={{ marginBottom: 0 }}>
            <TextArea
              rows={6}
              placeholder="例如：负责公司物流系统的后端开发，要求熟练掌握 Python、熟悉高并发处理，有大型电商物流项目经验优先……"
            />
          </Form.Item>
        </Card>

        <Card title="② AI 面试者的简历" style={{ marginBottom: 16 }}>
          <Text type="secondary" style={{ display: 'block', marginBottom: 8 }}>
            粘贴这份求职者的简历/个人经历，AI 面试者将基于它作答。
          </Text>
          <Form.Item name="resume" style={{ marginBottom: 0 }}>
            <TextArea
              rows={6}
              placeholder="例如：张三，3年Python后端开发经验，上一家在做电商平台，负责订单模块和消息队列，熟悉 Django、Redis，带过2人小团队……"
            />
          </Form.Item>
        </Card>

        <Card title="③ 面试者水平等级" style={{ marginBottom: 16 }}>
          <Text type="secondary" style={{ display: 'block', marginBottom: 8 }}>
            决定 AI 面试者的作答水平。选择"不限"则 AI 全力回答；选择低等级则会答非所问、钻牛角尖。
          </Text>
          <Form.Item name="level" style={{ marginBottom: 0 }}>
            <Select style={{ width: 260 }}>
              <Select.Option value="unlimited">不限制水平（正常全力回答）</Select.Option>
              <Select.Option value="high">高水平</Select.Option>
              <Select.Option value="medium">中水平</Select.Option>
              <Select.Option value="low">低水平（答非所问、钻牛角尖）</Select.Option>
            </Select>
          </Form.Item>
        </Card>

        <div style={{ textAlign: 'right' }}>
          <Button type="primary" size="large" htmlType="submit" loading={submitting}>
            创建会话并开始模拟面试
          </Button>
        </div>
      </Form>
    </div>
  )
}

export default MockInterviewSetup
