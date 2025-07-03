import React from 'react'
import { Layout, Menu, Avatar, Dropdown, Button } from 'antd'
import {
  UserOutlined,
  FileTextOutlined,
  QuestionCircleOutlined,
  HomeOutlined,
  LogoutOutlined,
  ControlOutlined,
} from '@ant-design/icons'
import { Link, useLocation, useNavigate } from 'react-router-dom'

const { Sider, Content, Header } = Layout

const menuItems = [
  {
    key: 'user-center',
    icon: <HomeOutlined />,
    label: '用户中心',
    children: [
      { key: 'home', icon: <HomeOutlined />, label: <Link to="/">首页</Link> },
    ],
  },
  {
    key: 'interview',
    icon: <FileTextOutlined />,
    label: '面试管理',
    children: [
      { key: 'interview-new', label: <Link to="/interview/new">新的面试</Link> },
      { key: 'interview-record', label: <Link to="/interview/record">面试记录</Link> },
    ],
  },
  {
    key: 'help',
    icon: <QuestionCircleOutlined />,
    label: <Link to="/help">帮助</Link>,
  },
  {
    key: 'settings',
    icon: <ControlOutlined />,
    label: <Link to="/settings">系统设置</Link>,
  },
]

const userMenu = (
  <Menu>
    <Menu.Item key="logout" icon={<LogoutOutlined />}>
      <Button type="text" style={{ width: '100%' }}>退出登录</Button>
    </Menu.Item>
  </Menu>
)

const MainLayout: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const location = useLocation()
  const navigate = useNavigate()
  // 选中菜单项
  const selectedKeys = React.useMemo(() => {
    const path = location.pathname
    if (path === '/') return ['home']
    if (path.startsWith('/interview/new')) return ['interview-new']
    if (path.startsWith('/interview/record')) return ['interview-record']
    if (path.startsWith('/help')) return ['help']
    if (path.startsWith('/settings')) return ['settings']
    return []
  }, [location.pathname])

  return (
    <Layout style={{ minHeight: '100vh', width: '100%' }}>
      {/* 顶部Header横跨全屏 */}
      <Header style={{ background: '#fff', padding: '0 32px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', height: 56, borderBottom: '1px solid #f0f0f0', boxShadow: 'none', zIndex: 10 }}>
        <div style={{ display: 'flex', alignItems: 'center', height: '100%' }}>
          <img src="/logo.png" alt="logo" style={{ height: 36, marginRight: 8 }} />
        </div>
        <Dropdown overlay={userMenu} placement="bottomRight">
          <div style={{ display: 'flex', alignItems: 'center', cursor: 'pointer' }}>
            <Avatar size={36} icon={<UserOutlined />} style={{ marginRight: 8 }} />
            <span style={{ fontWeight: 500, fontSize: 16, color: '#333' }}>17***171</span>
          </div>
        </Dropdown>
      </Header>
      {/* 主体区域：左侧Menu，右侧内容 */}
      <Layout style={{ height: 'calc(100vh - 56px)' }}>
        <Sider width={220} style={{ background: '#fff', borderRight: '1px solid #f0f0f0', minHeight: '100%' }}>
          <Menu
            mode="inline"
            selectedKeys={selectedKeys}
            defaultOpenKeys={['user-center', 'interview']}
            items={menuItems}
            style={{ height: '100%', borderRight: 0 }}
          />
        </Sider>
        <Content style={{ margin: 0, background: '#f7f8fa', minHeight: '100%', padding: 0, width: '100%' }}>
          {children}
        </Content>
      </Layout>
    </Layout>
  )
}

export default MainLayout 