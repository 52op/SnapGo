import { useEffect, useState } from 'react'
import { Card, Form, Input, Button, message, Typography, Divider, Space, Alert } from 'antd'
import { SaveOutlined, SendOutlined, LinkOutlined } from '@ant-design/icons'
import { getSettings, updateSettings, testFormail } from '../api'

const { Title, Text } = Typography
const { TextArea } = Input

export default function Settings() {
  const [form] = Form.useForm()
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [testing, setTesting] = useState(false)

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

  const handleTestFormail = async () => {
    const values = form.getFieldsValue()
    if (!values.formail_url || !values.formail_apikey || !values.notify_email) {
      message.warning('请先填写 Formail 地址、API Key 和通知邮箱')
      return
    }
    setTesting(true)
    try {
      const res = await testFormail({
        formail_url: values.formail_url,
        apikey: values.formail_apikey,
        email: values.notify_email,
      })
      message.success(res.message || '测试邮件已发送')
    } catch (e: any) {
      message.error(e.message || '测试失败')
    }
    setTesting(false)
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
          <Alert
            type="info"
            showIcon
            style={{ marginBottom: 16 }}
            message={<span>需要一个 Formail 账号来发送邮件通知。<a href="https://formail.it0731.cn" target="_blank" rel="noreferrer">点击注册 Formail <LinkOutlined /></a></span>}
          />
          <Form.Item name="formail_url" label="Formail 服务地址" help="填写 Formail 的根地址即可，系统会自动拼接 /v1/emails 接口路径">
            <Input placeholder="https://formail.it0731.cn" />
          </Form.Item>
          <Form.Item name="formail_apikey" label="Formail API Key" help="在 Formail 后台 → API Keys 中创建，以 fm_ 开头">
            <Input.Password placeholder="fm_xxxxxxxxxxxxxxxx" />
          </Form.Item>
          <Form.Item name="notify_email" label="通知邮箱" help="备份成功/失败时发送通知到此邮箱">
            <Input placeholder="admin@example.com" />
          </Form.Item>
          <Form.Item>
            <Button icon={<SendOutlined />} onClick={handleTestFormail} loading={testing}>
              发送测试邮件
            </Button>
            <Text type="secondary" style={{ marginLeft: 8 }}>先保存设置，再点击测试</Text>
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
