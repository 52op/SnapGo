import { useEffect, useState } from 'react'
import { Table, Button, Modal, Form, Input, Select, InputNumber, Switch, Radio, Space, message, Popconfirm, Typography } from 'antd'
import { PlusOutlined, EditOutlined, DeleteOutlined } from '@ant-design/icons'
import { listDestinations, createDestination, updateDestination, deleteDestination, testDestination, listProviders } from '../api'

const { Title } = Typography

export default function Destinations() {
  const [data, setData] = useState<any[]>([])
  const [loading, setLoading] = useState(false)
  const [testingId, setTestingId] = useState<number | null>(null)
  const [modalOpen, setModalOpen] = useState(false)
  const [editing, setEditing] = useState<any>(null)
  const [destType, setDestType] = useState<string>('s3')
  const [useProvider, setUseProvider] = useState<boolean>(false)
  const [providers, setProviders] = useState<any[]>([])
  const [form] = Form.useForm()

  const load = async () => {
    setLoading(true)
    try { setData(await listDestinations()) } catch {}
    try { setProviders(await listProviders()) } catch {}
    setLoading(false)
  }

  useEffect(() => { load() }, [])

  const handleTest = async (id: number) => {
    setTestingId(id)
    try {
      const res = await testDestination(id)
      message.success('连接测试通过：' + (res.message || ''))
    } catch (e: any) { message.error(e.message) }
    setTestingId(null)
  }

  const buildConfig = (values: any) => {
    if (useProvider) {
      return JSON.stringify({ path: values.path || '' })
    }
    const base: any = { type: values.dest_type, path: values.path || '' }
    switch (values.dest_type) {
      case 's3':
        Object.assign(base, { endpoint: values.endpoint, bucket: values.bucket, region: values.region || 'auto', access_key_id: values.access_key_id, secret_access_key: values.secret_access_key })
        break
      case 'webdav':
        Object.assign(base, { url: values.url, user: values.user, password: values.password })
        break
      case 'ftp':
      case 'sftp':
        Object.assign(base, { endpoint: values.host, user: values.user, password: values.password })
        break
      case 'local':
        Object.assign(base, { path: values.path })
        break
    }
    return JSON.stringify(base)
  }

  const handleSave = async (values: any) => {
    try {
      const config = buildConfig(values)
      const keepOne = values.keep_one ?? false
      const payload: any = { name: values.name, dest_type: values.dest_type, config, max_retention: keepOne ? 0 : (values.max_retention || 30), keep_one: keepOne, enabled: values.enabled ?? true }
      if (useProvider) {
        payload.storage_provider_id = values.storage_provider_id
      }
      if (editing) {
        await updateDestination(editing.id, payload)
        message.success('更新成功')
      } else {
        await createDestination(payload)
        message.success('创建成功')
      }
      setModalOpen(false)
      setEditing(null)
      form.resetFields()
      load()
    } catch (e: any) { message.error(e.message) }
  }

  const handleDelete = async (id: number) => {
    try { await deleteDestination(id); message.success('删除成功'); load() }
    catch (e: any) { message.error(e.message) }
  }

  const columns = [
    { title: '名称', dataIndex: 'name', key: 'name' },
    { title: '类型', dataIndex: 'dest_type', key: 'dest_type', render: (t: string) => ({ s3: 'S3 兼容', webdav: 'WebDAV', ftp: 'FTP', sftp: 'SFTP', local: '本地' })[t] || t },
    { title: '保留策略', dataIndex: 'keep_one', key: 'keep_one', render: (keep: boolean, record: any) => keep ? '唯一' : (record.max_retention ? `${record.max_retention}天` : '永久') },
    { title: '启用', dataIndex: 'enabled', key: 'enabled', render: (v: boolean) => v ? '是' : '否' },
    {
      title: '操作', key: 'action',
      render: (_: any, record: any) => (
        <Space>
          <Button type="link" loading={testingId === record.id} onClick={() => handleTest(record.id)}>测试连接</Button>
          <Button type="link" icon={<EditOutlined />} onClick={() => {
            setEditing(record)
            const cfg = JSON.parse(record.config || '{}')
            const hasProvider = record.storage_provider_id != null
            setUseProvider(hasProvider)
            const vals: any = { name: record.name, dest_type: record.dest_type, max_retention: record.max_retention, keep_one: record.keep_one, enabled: !!record.enabled }
            if (hasProvider) {
              vals.storage_provider_id = record.storage_provider_id
              vals.path = cfg.path || ''
            } else {
              Object.assign(vals, cfg)
            }
            form.setFieldsValue(vals)
            setDestType(record.dest_type)
            setModalOpen(true)
          }}>编辑</Button>
          <Popconfirm title="确定删除?" onConfirm={() => handleDelete(record.id)}>
            <Button type="link" danger icon={<DeleteOutlined />}>删除</Button>
          </Popconfirm>
        </Space>
      ),
    },
  ]

  const destTypeOptions = [
    { value: 's3', label: 'S3 兼容存储' },
    { value: 'webdav', label: 'WebDAV' },
    { value: 'ftp', label: 'FTP' },
    { value: 'sftp', label: 'SFTP' },
    { value: 'local', label: '本地目录' },
  ]

  const filteredProviders = providers.filter(p => p.dest_type === destType)

  const renderConfigFields = () => {
    const pathField = (
      <Form.Item name="path" label={useProvider ? '路径前缀' : (destType === 'local' ? '路径' : '路径前缀')} help={useProvider ? '备份文件存放的子路径' : undefined}>
        <Input placeholder={destType === 'local' ? 'D:\\backups' : 'backups/mydb'} />
      </Form.Item>
    )

    if (useProvider) {
      return (<>
        <Form.Item name="storage_provider_id" label="引用提供商" rules={[{ required: true }]}>
          <Select placeholder="选择已添加的存储提供商">
            {filteredProviders.map(p => <Select.Option key={p.id} value={p.id}>{p.name}</Select.Option>)}
          </Select>
        </Form.Item>
        {pathField}
      </>)
    }

    switch (destType) {
      case 's3':
        return (<>
          <Form.Item name="endpoint" label="Endpoint" rules={[{ required: true }]}><Input placeholder="https://s3.amazonaws.com" /></Form.Item>
          <Form.Item name="bucket" label="Bucket" rules={[{ required: true }]}><Input placeholder="my-backups" /></Form.Item>
          <Form.Item name="region" label="Region"><Input placeholder="auto" /></Form.Item>
          <Form.Item name="access_key_id" label="Access Key ID" rules={[{ required: true }]}><Input /></Form.Item>
          <Form.Item name="secret_access_key" label="Secret Access Key" rules={[{ required: true }]}><Input.Password /></Form.Item>
          {pathField}
        </>)
      case 'webdav':
        return (<>
          <Form.Item name="url" label="WebDAV URL" rules={[{ required: true }]}><Input placeholder="https://example.com/remote.php/dav/" /></Form.Item>
          <Form.Item name="user" label="用户名" rules={[{ required: true }]}><Input /></Form.Item>
          <Form.Item name="password" label="密码" rules={[{ required: true }]}><Input.Password /></Form.Item>
          {pathField}
        </>)
      case 'ftp':
      case 'sftp':
        return (<>
          <Form.Item name="host" label="主机地址" rules={[{ required: true }]}><Input placeholder="example.com:22" /></Form.Item>
          <Form.Item name="user" label="用户名" rules={[{ required: true }]}><Input /></Form.Item>
          <Form.Item name="password" label="密码" rules={[{ required: true }]}><Input.Password /></Form.Item>
          {pathField}
        </>)
      case 'local':
        return (<>
          {pathField}
        </>)
      default:
        return null
    }
  }

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 16 }}>
        <Title level={4}>备份目标管理</Title>
        <Button type="primary" icon={<PlusOutlined />} onClick={() => { setEditing(null); form.resetFields(); setDestType('s3'); setUseProvider(false); setModalOpen(true) }}>添加备份目标</Button>
      </div>
      <Table dataSource={data} columns={columns} rowKey="id" loading={loading} size="small" />

      <Modal title={editing ? '编辑备份目标' : '添加备份目标'} open={modalOpen} onCancel={() => { form.resetFields(); setModalOpen(false); setEditing(null) }} onOk={() => form.submit()} width={600}>
        <Form form={form} layout="vertical" onFinish={handleSave} initialValues={{ dest_type: 's3', max_retention: 30, enabled: true }}>
          <Form.Item name="name" label="名称" rules={[{ required: true }]}><Input placeholder="例如：项目1 数据库备份" /></Form.Item>
          <Form.Item name="dest_type" label="存储类型" rules={[{ required: true }]}>
            <Select options={destTypeOptions} onChange={v => { setDestType(v); setUseProvider(false) }} />
          </Form.Item>
          {filteredProviders.length > 0 && (
            <Form.Item label="配置方式">
              <Radio.Group value={useProvider} onChange={e => setUseProvider(e.target.value)}>
                <Radio value={false}>直接填写</Radio>
                <Radio value={true}>引用已有提供商</Radio>
              </Radio.Group>
            </Form.Item>
          )}
          {renderConfigFields()}
          <Form.Item name="keep_one" label="始终唯一" valuePropName="checked"><Switch /></Form.Item>
          <Form.Item noStyle shouldUpdate={(prev, cur) => prev.keep_one !== cur.keep_one}>
            {({ getFieldValue }) =>
              getFieldValue('keep_one') ? null : (
                <Form.Item name="max_retention" label="保留天数(0=永久)"><InputNumber min={0} style={{ width: '100%' }} /></Form.Item>
              )
            }
          </Form.Item>
          <Form.Item name="enabled" label="启用" valuePropName="checked"><Switch /></Form.Item>
        </Form>
      </Modal>
    </div>
  )
}
