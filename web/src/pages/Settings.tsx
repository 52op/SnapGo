import { useEffect, useState } from 'react'
import { Card, Form, Input, Button, message, Typography, Divider, Space } from 'antd'
import { SaveOutlined } from '@ant-design/icons'
import { getSettings, updateSettings } from '../api'

const { Title, Text } = Typography
const { TextArea } = Input

export default function Settings() {
  const [form] = Form.useForm()
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    setLoading(true)
    getSettings().then(data => {
      form.setFieldsValue(data || {})
    }).catch(() => {}).finally(() => setLoading(false))
  }, [])

  const handleSave = async (values: any) => {
    setSaving(true)
    try {
      await updateSettings(values)
      message.success('保存成功')
    } catch (e: any) {
      message.error(e.message || '保存失败')
    }
    setSaving(false)
  }

  return (
    <div style={{ maxWidth: 700, margin: '0 auto' }}>
      <Title level={4}>系统设置</Title>

      <Form form={form} layout="vertical" onFinish={handleSave} loading={loading}>
        <Card title="站点信息" style={{ marginBottom: 16 }}>
          <Form.Item name="site_title" label="站点标题" help="显示在浏览器标签和页面顶部">
            <Input placeholder="SnapGo - 服务器备份管理" />
          </Form.Item>
          <Form.Item name="site_description" label="站点描述" help="用于 SEO meta description">
            <TextArea rows={2} placeholder="简单可靠的服务器备份管理工具" />
          </Form.Item>
          <Form.Item name="site_keywords" label="关键词" help="用于 SEO meta keywords，逗号分隔">
            <Input placeholder="备份,服务器,自动化,S3,FTP" />
          </Form.Item>
          <Form.Item name="site_logo" label="Logo URL">
            <Input placeholder="https://example.com/logo.png" />
          </Form.Item>
          <Form.Item name="site_favicon" label="Favicon URL">
            <Input placeholder="https://example.com/favicon.ico" />
          </Form.Item>
          <Form.Item name="site_footer" label="页脚内容" help="支持 HTML">
            <TextArea rows={3} placeholder="&copy; 2026 SnapGo" />
          </Form.Item>
        </Card>

        <Card title="Formail 邮件通知" style={{ marginBottom: 16 }}>
          <Text type="secondary" style={{ display: 'block', marginBottom: 16 }}>
            配置 Formail 服务地址和 API Key 后，可在备份任务中开启「备份成功邮件通知」。
          </Text>
          <Form.Item name="formail_url" label="Formail 服务地址" help="Formail 实例的完整地址，如 https://mail.example.com">
            <Input placeholder="https://mail.example.com" />
          </Form.Item>
          <Form.Item name="formail_apikey" label="Formail API Key" help="在 Formail 后台 → API Keys 中创建，以 fm_ 开头">
            <Input.Password placeholder="fm_xxxxxxxxxxxxxxxx" />
          </Form.Item>
          <Form.Item name="notify_email" label="通知邮箱" help="备份成功/失败时发送通知到此邮箱">
            <Input placeholder="admin@example.com" />
          </Form.Item>
        </Card>

        <Form.Item>
          <Button type="primary" htmlType="submit" icon={<SaveOutlined />} loading={saving} size="large">
            保存设置
          </Button>
        </Form.Item>
      </Form>
    </div>
  )
}
