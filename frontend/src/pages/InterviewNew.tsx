import React from 'react'
import { Form, Select, Button, Typography, Divider, Space, Alert } from 'antd'
import { useInterviewStore } from '../store/interviewStore'
import { useNavigate } from 'react-router-dom'

const { Title, Text, Link } = Typography

const InterviewNew: React.FC = () => {
  const [form] = Form.useForm()
  const interviewConfig = useInterviewStore((s) => s.interviewConfig)
  const setInterviewConfig = useInterviewStore((s) => s.setInterviewConfig)
  const navigate = useNavigate()

  // 表单初始值同步store
  React.useEffect(() => {
    form.setFieldsValue(interviewConfig)
  }, [form, interviewConfig])

  // 表单项变更同步store
  const handleValuesChange = (changed: any, all: any) => {
    setInterviewConfig(changed)
  }

  // 新增：前往面试按钮点击事件
  const handleGoToMeeting = () => {
    const values = form.getFieldsValue()
    const params = new URLSearchParams({
      region: values.region || '',
      job: values.job || '',
      lang: values.lang || ''
    }).toString()
    navigate(`/interview/meeting?${params}`)
  }

  return (
    <div style={{ width: '100%' }}>
      <Form
        form={form}
        layout="vertical"
        initialValues={interviewConfig}
        onValuesChange={handleValuesChange}
        style={{ background: '#fff', borderRadius: 8, padding: 0, minHeight: '100vh' }}
      >
        {/* 地区和岗位 */}
        <div style={{ padding: '32px 32px 0 32px' }}>
          <Title level={5} style={{ marginBottom: 16 }}>请选择面试地区和岗位</Title>
          <Space size="large" wrap>
            <Form.Item label="地区" name="region" style={{ marginBottom: 0 }}>
              <Select style={{ width: 160 }}>
                <Select.Option value="简体中文">简体中文</Select.Option>
                <Select.Option value="繁体中文">繁体中文</Select.Option>
                <Select.Option value="英文">英文</Select.Option>
              </Select>
            </Form.Item>
            <Form.Item label="岗位" name="job" style={{ marginBottom: 0 }}>
              <Select style={{ width: 160 }}>
                <Select.Option value="前端">前端</Select.Option>
                <Select.Option value="后端">后端</Select.Option>
                <Select.Option value="全栈">全栈</Select.Option>
                <Select.Option value="测试">测试</Select.Option>
                <Select.Option value="产品">产品</Select.Option>
              </Select>
            </Form.Item>
            <Text type="secondary">没有想要的岗位？<Link href="#">联系小助手一键添加</Link></Text>
          </Space>
        </div>
        <Divider style={{ margin: '24px 0' }} />
        {/* 技术定制 */}
        <div style={{ padding: '0 32px' }}>
          <Title level={5} style={{ marginBottom: 16 }}>技术定制</Title>
          <Space size="large" wrap>
            <Form.Item label="编程语言（只针对笔试功能）" name="lang" style={{ marginBottom: 0 }}>
              <Select style={{ width: 160 }}>
                <Select.Option value="Typescript">Typescript</Select.Option>
                <Select.Option value="JavaScript">JavaScript</Select.Option>
                <Select.Option value="Java">Java</Select.Option>
                <Select.Option value="Python">Python</Select.Option>
                <Select.Option value="C++">C++</Select.Option>
              </Select>
            </Form.Item>
            <Form.Item label="是否使用自定义问答库" name="customQA" style={{ marginBottom: 0 }}>
              <Select style={{ width: 120 }}>
                <Select.Option value="否">否</Select.Option>
                <Select.Option value="是">是</Select.Option>
              </Select>
            </Form.Item>
            <Text type="danger">当前问答库为空</Text>
            <Button type="primary">创建问答库</Button>
          </Space>
        </div>
        <Divider style={{ margin: '24px 0' }} />
        {/* 模式选择 */}
        <div style={{ padding: '0 32px' }}>
          <Title level={5} style={{ marginBottom: 16 }}>模式选择</Title>
          <Alert
            message={<span>你并未上传简历，AI将无法基于简历回答，<Link href="#">去上传</Link></span>}
            type="info"
            showIcon
            style={{ marginBottom: 16 }}
          />
        </div>
        <Divider style={{ margin: '24px 0' }} />
        {/* 开始面试 */}
        <div style={{ padding: '0 32px 32px 32px' }}>
          <Form.Item style={{ marginBottom: 0 }}>
            <Button type="primary" size="large" onClick={handleGoToMeeting}>前往面试</Button>
          </Form.Item>
        </div>
      </Form>
    </div>
  )
}

export default InterviewNew 