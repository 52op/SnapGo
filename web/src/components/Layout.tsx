import { Outlet, useNavigate, useLocation } from 'react-router-dom'
import { Layout as AntLayout, Menu, Button, theme } from 'antd'
import {
  DashboardOutlined,
  DatabaseOutlined,
  CloudUploadOutlined,
  ScheduleOutlined,
  FileTextOutlined,
  LogoutOutlined,
  CloudServerOutlined,
} from '@ant-design/icons'
import { setToken, getMe } from '../api'
import { useEffect, useState } from 'react'

const { Header, Sider, Content } = AntLayout

export default function Layout() {
  const navigate = useNavigate()
  const location = useLocation()
  const { token: themeToken } = theme.useToken()
  const [username, setUsername] = useState('')

  useEffect(() => {
    getMe().then(u => setUsername(u.username)).catch(() => {})
  }, [])

  const menuItems = [
    { key: '/', icon: <DashboardOutlined />, label: '仪表盘' },
    { key: '/sources', icon: <DatabaseOutlined />, label: '备份源' },
    { key: '/providers', icon: <CloudServerOutlined />, label: '存储提供商' },
    { key: '/destinations', icon: <CloudUploadOutlined />, label: '备份目标' },
    { key: '/jobs', icon: <ScheduleOutlined />, label: '备份任务' },
    { key: '/logs', icon: <FileTextOutlined />, label: '执行日志' },
  ]

  const handleLogout = () => {
    setToken(null)
    navigate('/login')
  }

  return (
    <AntLayout style={{ minHeight: '100vh' }}>
      <Sider theme="dark" collapsible>
        <div style={{ height: 64, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontSize: 20, fontWeight: 'bold' }}>
          SnapGo
        </div>
        <Menu
          theme="dark"
          mode="inline"
          selectedKeys={[location.pathname]}
          items={menuItems}
          onClick={({ key }: { key: string }) => navigate(key)}
        />
      </Sider>
      <AntLayout>
        <Header style={{ background: themeToken.colorBgContainer, padding: '0 24px', display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 16 }}>
          <span>{username}</span>
          <Button type="text" icon={<LogoutOutlined />} onClick={handleLogout}>退出</Button>
        </Header>
        <Content style={{ margin: 24 }}>
          <Outlet />
        </Content>
      </AntLayout>
    </AntLayout>
  )
}
