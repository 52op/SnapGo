import { useEffect, useState } from 'react'
import { Table, Button, Modal, Form, Input, Select, Space, message, Popconfirm, Typography } from 'antd'
import { PlusOutlined, EditOutlined, DeleteOutlined } from '@ant-design/icons'
import { listProviders, createProvider, updateProvider, deleteProvider, testProvider } from '../api'

const { Title } = Typography

export default function StorageProviders() {
  const [data, setData] = useState<any[]>([])
  const [loading, setLoading] = useState(false)
  const [testing, setTesting] = useState(false)
  const [modalOpen, setModalOpen] = useState(false)
  const [editing, setEditing] = useState<any>(null)
  const [destType, setDestType] = useState<string>('s3')
  const [form] = Form.useForm()

  const load = async () => {
    setLoading(true)
    try { setData(await listProviders()) } catch {}
    setLoading(false)
  }

  useEffect(() => { load() }, [])

  const buildConfig = (values: any) => {
    const base: any = {}
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

  const handleTest = async () => {
    try {
      const values = await form.validateFields()
      setTesting(true)
      const config = buildConfig(values)
      const res = await testProvider({ dest_type: values.dest_type, config })
      message.success('连接测试通过：' + (res.message || ''))
    } catch (e: any) { message.error(e.message || '测试失败') }
    setTesting(false)
  }

  const handleSave = async (values: any) => {
    try {
      const config = buildConfig(values)
      if (editing) {
        await updateProvider(editing.id, { name: values.name, dest_type: values.dest_type, config })
        message.success('更新成功')
      } else {
        await createProvider({ name: values.name, dest_type: values.dest_type, config })
        message.success('创建成功')
      }
      setModalOpen(false)
      setEditing(null)
      form.resetFields()
      load()
    } catch (e: any) { message.error(e.message) }
  }

  const handleDelete = async (id: number) => {
    try { await deleteProvider(id); message.success('删除成功'); load() }
    catch (e: any) { message.error(e.message) }
  }

  const providerTypes = [
    { value: 's3', label: 'S3 兼容存储' },
    { value: 'webdav', label: 'WebDAV' },
    { value: 'ftp', label: 'FTP' },
    { value: 'sftp', label: 'SFTP' },
    { value: 'local', label: '本地目录' },
  ]

  const renderConfigFields = () => {
    switch (destType) {
      case 's3':
        return (<>
          <Form.Item name="endpoint" label="Endpoint" rules={[{ required: true }]}><Input placeholder="https://s3.amazonaws.com" /></Form.Item>
          <Form.Item name="bucket" label="Bucket" rules={[{ required: true }]}><Input placeholder="my-backups" /></Form.Item>
          <Form.Item name="region" label="Region"><Input placeholder="auto" /></Form.Item>
          <Form.Item name="access_key_id" label="Access Key ID" rules={[{ required: true }]}><Input /></Form.Item>
          <Form.Item name="secret_access_key" label="Secret Access Key" rules={[{ required: true }]}><Input.Password /></Form.Item>
        </>)
      case 'webdav':
        return (<>
          <Form.Item name="url" label="WebDAV URL" rules={[{ required: true }]}><Input placeholder="https://example.com/remote.php/dav/" /></Form.Item>
          <Form.Item name="user" label="用户名" rules={[{ required: true }]}><Input /></Form.Item>
          <Form.Item name="password" label="密码" rules={[{ required: true }]}><Input.Password /></Form.Item>
        </>)
      case 'ftp':
      case 'sftp':
        return (<>
          <Form.Item name="host" label="主机地址" rules={[{ required: true }]}><Input placeholder="example.com:22" /></Form.Item>
          <Form.Item name="user" label="用户名" rules={[{ required: true }]}><Input /></Form.Item>
          <Form.Item name="password" label="密码" rules={[{ required: true }]}><Input.Password /></Form.Item>
        </>)
      case 'local':
        return (<>
          <Form.Item name="path" label="路径" rules={[{ required: true }]}><Input placeholder="D:\backups" /></Form.Item>
        </>)
      default:
        return null
    }
  }

  const columns = [
    { title: '名称', dataIndex: 'name', key: 'name' },
    { title: '类型', dataIndex: 'dest_type', key: 'dest_type', render: (t: string) => ({ s3: 'S3 兼容', webdav: 'WebDAV', ftp: 'FTP', sftp: 'SFTP', local: '本地' })[t] || t },
    { title: '更新时间', dataIndex: 'updated_at', key: 'updated_at', render: (v: string) => v ? new Date(v).toLocaleString() : '' },
    {
      title: '操作', key: 'action',
      render: (_: any, record: any) => (
        <Space>
          <Button type="link" icon={<EditOutlined />} onClick={() => { setEditing(record); setDestType(record.dest_type); form.setFieldsValue({ name: record.name, dest_type: record.dest_type, ...JSON.parse(record.config || '{}') }); setModalOpen(true) }}>编辑</Button>
          <Popconfirm title="确定删除? 如有备份目标引用此提供商将无法删除" onConfirm={() => handleDelete(record.id)}>
            <Button type="link" danger icon={<DeleteOutlined />}>删除</Button>
          </Popconfirm>
        </Space>
      ),
    },
  ]

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 16 }}>
        <Title level={4}>存储提供商管理</Title>
        <Button type="primary" icon={<PlusOutlined />} onClick={() => { setEditing(null); form.resetFields(); setDestType('s3'); setModalOpen(true) }}>添加提供商</Button>
      </div>
      <Table dataSource={data} columns={columns} rowKey="id" loading={loading} size="small" />

      <Modal title={editing ? '编辑存储提供商' : '添加存储提供商'} open={modalOpen} onCancel={() => { form.resetFields(); setModalOpen(false); setEditing(null) }} onOk={() => form.submit()} width={600}
        footer={<Space><Button onClick={() => { form.resetFields(); setModalOpen(false); setEditing(null) }}>取消</Button><Button loading={testing} onClick={handleTest}>测试连接</Button><Button type="primary" onClick={() => form.submit()}>{editing ? '保存' : '创建'}</Button></Space>}>
        <Form form={form} layout="vertical" onFinish={handleSave} initialValues={{ dest_type: 's3' }}>
          <Form.Item name="name" label="名称" rules={[{ required: true }]}><Input placeholder="例如：阿里云OSS" /></Form.Item>
          <Form.Item name="dest_type" label="存储类型" rules={[{ required: true }]}>
            <Select options={providerTypes} onChange={(v) => setDestType(v)} />
          </Form.Item>
          {renderConfigFields()}
        </Form>
      </Modal>
    </div>
  )
}
