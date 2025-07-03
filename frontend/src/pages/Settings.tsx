import { Card, Form, Input, Button, Tabs, Space, Typography, Divider, message, InputNumber } from 'antd'
import { SaveOutlined, ReloadOutlined, DeleteOutlined } from '@ant-design/icons'
import { useXfyunConfigStore } from '../store/xfyunConfigStore'
import { useApiConfigStore } from '../store/apiConfigStore'

const { Title, Text } = Typography
const { TabPane } = Tabs

export default function Settings() {
  const { config: xfyunConfig, updateConfig: updateXfyunConfig, clearConfig: clearXfyunConfig } = useXfyunConfigStore()
  const { apiConfigs, updateConfig: updateApiConfig } = useApiConfigStore()
  
  const [xfyunForm] = Form.useForm()
  const [deepseekForm] = Form.useForm()

  // 获取默认的DeepSeek配置
  const deepseekConfig = apiConfigs.find(config => config.apiProvider === 'deepseek') || apiConfigs[0]

  const handleXfyunSave = (values: any) => {
    updateXfyunConfig(values.appId, values.apiKey)
    message.success('科大讯飞配置已保存')
  }

  const handleXfyunClear = () => {
    clearXfyunConfig()
    xfyunForm.resetFields()
    message.success('科大讯飞配置已清除')
  }

  const handleDeepSeekSave = (values: any) => {
    if (deepseekConfig) {
      updateApiConfig(deepseekConfig.seq, {
        apiKey: values.apiKey,
        baseUrl: values.baseUrl,
        model: values.model,
        maxTokens: values.maxTokens,
        temperature: values.temperature,
      })
      message.success('DeepSeek配置已保存')
    }
  }

  return (
    <div style={{ padding: '24px', maxWidth: '800px', margin: '0 auto' }}>
      <Title level={2}>应用设置</Title>
      <Text type="secondary">配置API密钥和相关参数</Text>
      
      <Divider />
      
      <Tabs defaultActiveKey="xfyun" type="card">
        <TabPane tab="科大讯飞语音" key="xfyun">
          <Card title="科大讯飞RTasr API配置">
            <Form
              form={xfyunForm}
              layout="vertical"
              onFinish={handleXfyunSave}
              initialValues={{
                appId: xfyunConfig.appId,
                apiKey: xfyunConfig.apiKey,
              }}
            >
              <Form.Item
                label="App ID"
                name="appId"
                rules={[{ required: true, message: '请输入科大讯飞App ID' }]}
              >
                <Input 
                  placeholder="请输入科大讯飞App ID"
                  size="large"
                />
              </Form.Item>
              
              <Form.Item
                label="API Key"
                name="apiKey"
                rules={[{ required: true, message: '请输入科大讯飞API Key' }]}
              >
                <Input.Password 
                  placeholder="请输入科大讯飞API Key"
                  size="large"
                />
              </Form.Item>
              
              <Form.Item>
                <Space>
                  <Button 
                    type="primary" 
                    htmlType="submit" 
                    icon={<SaveOutlined />}
                    size="large"
                  >
                    保存配置
                  </Button>
                  <Button 
                    onClick={handleXfyunClear}
                    icon={<DeleteOutlined />}
                    size="large"
                  >
                    清除配置
                  </Button>
                </Space>
              </Form.Item>
            </Form>
            
            <Divider />
            
            <div>
              <Text strong>配置状态：</Text>
              <Text type={xfyunConfig.isConfigured ? "success" : "warning"}>
                {xfyunConfig.isConfigured ? " ✅ 已配置" : " ⚠️ 未配置"}
              </Text>
            </div>
            
            {xfyunConfig.updatedAt && (
              <div style={{ marginTop: 8 }}>
                <Text type="secondary">
                  最后更新：{new Date(xfyunConfig.updatedAt).toLocaleString()}
                </Text>
              </div>
            )}
          </Card>
        </TabPane>
        
        <TabPane tab="DeepSeek AI" key="deepseek">
          <Card title="DeepSeek API配置">
            <Form
              form={deepseekForm}
              layout="vertical"
              onFinish={handleDeepSeekSave}
              initialValues={{
                apiKey: deepseekConfig?.apiKey || '',
                baseUrl: deepseekConfig?.baseUrl || 'https://api.deepseek.com',
                model: deepseekConfig?.model || 'deepseek-chat',
                maxTokens: deepseekConfig?.maxTokens || 2000,
                temperature: deepseekConfig?.temperature || 0.7,
              }}
            >
              <Form.Item
                label="API Key"
                name="apiKey"
                rules={[{ required: true, message: '请输入DeepSeek API Key' }]}
              >
                <Input.Password 
                  placeholder="请输入DeepSeek API Key"
                  size="large"
                />
              </Form.Item>
              
              <Form.Item
                label="API Base URL"
                name="baseUrl"
                rules={[{ required: true, message: '请输入API Base URL' }]}
              >
                <Input 
                  placeholder="https://api.deepseek.com"
                  size="large"
                />
              </Form.Item>
              
              <Form.Item
                label="模型名称"
                name="model"
                rules={[{ required: true, message: '请输入模型名称' }]}
              >
                <Input 
                  placeholder="deepseek-chat"
                  size="large"
                />
              </Form.Item>
              
              <Form.Item
                label="最大Token数"
                name="maxTokens"
                rules={[{ required: true, type: 'number', min: 1, max: 4000, message: '请输入1-4000之间的数字' }]}
              >
                <InputNumber 
                  placeholder="2000"
                  style={{ width: '100%' }}
                  size="large"
                  min={1}
                  max={4000}
                />
              </Form.Item>
              
              <Form.Item
                label="Temperature"
                name="temperature"
                rules={[{ required: true, type: 'number', min: 0, max: 2, message: '请输入0-2之间的数字' }]}
              >
                <InputNumber 
                  placeholder="0.7"
                  style={{ width: '100%' }}
                  size="large"
                  min={0}
                  max={2}
                  step={0.1}
                />
              </Form.Item>
              
              <Form.Item>
                <Button 
                  type="primary" 
                  htmlType="submit" 
                  icon={<SaveOutlined />}
                  size="large"
                >
                  保存配置
                </Button>
              </Form.Item>
            </Form>
            
            <Divider />
            
            <div>
              <Text strong>配置状态：</Text>
              <Text type={deepseekConfig?.apiKey ? "success" : "warning"}>
                {deepseekConfig?.apiKey ? " ✅ 已配置" : " ⚠️ 未配置"}
              </Text>
            </div>
            
            {deepseekConfig?.updatedAt && (
              <div style={{ marginTop: 8 }}>
                <Text type="secondary">
                  最后更新：{new Date(deepseekConfig.updatedAt).toLocaleString()}
                </Text>
              </div>
            )}
          </Card>
        </TabPane>
      </Tabs>
    </div>
  )
}