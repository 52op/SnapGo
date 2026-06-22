import { useEffect, useState } from 'react'
import { Table, Button, Modal, Form, Input, Select, Switch, Space, message, Popconfirm, Tag, Typography } from 'antd'
import { PlusOutlined, EditOutlined, DeleteOutlined, PlayCircleOutlined, ClockCircleOutlined } from '@ant-design/icons'
import { listJobs, createJob, updateJob, deleteJob, runJob, listSources, listDestinations } from '../api'
import CronHelper from '../components/CronHelper'

const { Title } = Typography
const { TextArea } = Input

export default function Jobs() {
  const [data, setData] = useState<any[]>([])
  const [sources, setSources] = useState<any[]>([])
  const [dests, setDests] = useState<any[]>([])
  const [loading, setLoading] = useState(false)
  const [modalOpen, setModalOpen] = useState(false)
  const [editing, setEditing] = useState<any>(null)
  const [cronHelperOpen, setCronHelperOpen] = useState(false)
  const [form] = Form.useForm()

  const load = async () => {
    setLoading(true)
    try {
      const [j, s, d] = await Promise.all([listJobs(), listSources(), listDestinations()])
      setData(j)
      setSources(s)
      setDests(d)
    } catch {}
    setLoading(false)
  }

  useEffect(() => { load() }, [])

  const handleSave = async (values: any) => {
    try {
      const payload = {
        ...values,
        source_ids: values.source_ids || [],
        dest_ids: values.dest_ids || [],
      }
      if (editing) {
        await updateJob(editing.id, payload)
        message.success('更新成功')
      } else {
        await createJob(payload)
        message.success('创建成功')
      }
      setModalOpen(false)
      setEditing(null)
      form.resetFields()
      load()
    } catch (e: any) { message.error(e.message) }
  }

  const handleDelete = async (id: number) => {
    try { await deleteJob(id); message.success('删除成功'); load() }
    catch (e: any) { message.error(e.message) }
  }

  const handleRun = async (id: number) => {
    try {
      const res = await runJob(id)
      message.success('任务已启动')
    } catch (e: any) { message.error(e.message) }
  }

  const openEdit = (record: any) => {
    setEditing(record)
    let sourceIDs: number[] = []
    let destIDs: number[] = []
    try { sourceIDs = JSON.parse(record.source_ids || '[]') } catch {}
    try { destIDs = JSON.parse(record.dest_ids || '[]') } catch {}
    form.setFieldsValue({ name: record.name, cron_expr: record.cron_expr, source_ids: sourceIDs, dest_ids: destIDs, encrypt_key: record.encrypt_key, notify_webhook: record.notify_webhook, notify_email_success: !!record.notify_email_success, notify_email_fail: !!record.notify_email_fail, enabled: !!record.enabled })
    setModalOpen(true)
  }

  const columns = [
    { title: '名称', dataIndex: 'name', key: 'name' },
    { title: 'Cron 表达式', dataIndex: 'cron_expr', key: 'cron_expr', render: (v: string) => v || <span style={{ color: '#999' }}>手动触发</span> },
    { title: '上次执行', dataIndex: 'last_run_at', key: 'last_run_at', render: (v: string) => v ? new Date(v).toLocaleString() : '-' },
    { title: '状态', dataIndex: 'last_status', key: 'last_status', render: (s: string) => {
      if (!s) return <Tag>未执行</Tag>
      return <Tag color={s === 'success' ? 'green' : 'red'}>{s === 'success' ? '成功' : '失败'}</Tag>
    }},
    { title: '启用', dataIndex: 'enabled', key: 'enabled', render: (v: boolean) => v ? '是' : '否' },
    {
      title: '操作', key: 'action', width: 200,
      render: (_: any, record: any) => (
        <Space>
          <Button type="link" icon={<PlayCircleOutlined />} onClick={() => handleRun(record.id)}>运行</Button>
          <Button type="link" icon={<EditOutlined />} onClick={() => openEdit(record)}>编辑</Button>
          <Popconfirm title="确定删除?" onConfirm={() => handleDelete(record.id)}>
            <Button type="link" danger icon={<DeleteOutlined />}>删除</Button>
          </Popconfirm>
        </Space>
      ),
    },
  ]

  const sourceOptions = (sources || []).filter((s: any) => s.enabled !== false).map((s: any) => ({ value: s.id, label: s.name }))
  const destOptions = (dests || []).filter((d: any) => d.enabled !== false).map((d: any) => ({ value: d.id, label: d.name }))

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 16 }}>
        <Title level={4}>备份任务管理</Title>
        <Button type="primary" icon={<PlusOutlined />} onClick={() => { setEditing(null); form.resetFields(); setModalOpen(true) }}>添加任务</Button>
      </div>
      <Table dataSource={data} columns={columns} rowKey="id" loading={loading} size="small" />

      <Modal title={editing ? '编辑备份任务' : '添加备份任务'} open={modalOpen} onCancel={() => { form.resetFields(); setModalOpen(false); setEditing(null) }} onOk={() => form.submit()} width={600}>
        <Form form={form} layout="vertical" onFinish={handleSave} initialValues={{ enabled: true }}>
          <Form.Item name="name" label="任务名称" rules={[{ required: true }]}><Input placeholder="例如：每天凌晨全量备份" /></Form.Item>
          <Form.Item name="cron_expr" label="Cron 表达式" help="留空表示仅手动触发">
            <Input placeholder="0 3 * * *" />
          </Form.Item>
          <Form.Item style={{ marginTop: -16, marginBottom: 8 }}>
            <Button size="small" icon={<ClockCircleOutlined />} onClick={() => setCronHelperOpen(true)}>Cron 助手</Button>
          </Form.Item>
          <CronHelper visible={cronHelperOpen} onClose={() => setCronHelperOpen(false)} onSelect={v => { form.setFieldValue('cron_expr', v); setCronHelperOpen(false) }} />
          <Form.Item name="source_ids" label="备份源" rules={[{ required: true, message: '请选择至少一个备份源' }]}>
            <Select mode="multiple" options={sourceOptions} placeholder="选择要备份的数据源" />
          </Form.Item>
          <Form.Item name="dest_ids" label="备份目标" rules={[{ required: true, message: '请选择至少一个备份目标' }]}>
            <Select mode="multiple" options={destOptions} placeholder="选择备份存储目标" />
          </Form.Item>
          <Form.Item name="encrypt_key" label="加密公钥(可选)" help="使用 age 加密，留空不加密">
            <TextArea rows={2} placeholder="age1..." />
          </Form.Item>
          <Form.Item name="notify_webhook" label="通知 Webhook(可选)">
            <Input placeholder="https://hooks.example.com/backup-notify" />
          </Form.Item>
          <Form.Item label="邮件通知" help="需先在系统设置中配置 Formail API Key 和通知邮箱">
            <Space>
              <Form.Item name="notify_email_success" valuePropName="checked" noStyle>
                <Switch checkedChildren="成功" unCheckedChildren="成功" />
              </Form.Item>
              <Form.Item name="notify_email_fail" valuePropName="checked" noStyle>
                <Switch checkedChildren="失败" unCheckedChildren="失败" />
              </Form.Item>
            </Space>
          </Form.Item>
          <Form.Item name="enabled" label="启用" valuePropName="checked"><Switch /></Form.Item>
        </Form>
      </Modal>
    </div>
  )
}
