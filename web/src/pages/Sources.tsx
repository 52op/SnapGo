import { useEffect, useState } from 'react'
import { Table, Button, Modal, Form, Input, Select, Switch, Space, message, Popconfirm, Typography } from 'antd'
import { PlusOutlined, EditOutlined, DeleteOutlined } from '@ant-design/icons'
import { listSources, createSource, updateSource, deleteSource } from '../api'

const { Title } = Typography

export default function Sources() {
  const [data, setData] = useState<any[]>([])
  const [loading, setLoading] = useState(false)
  const [modalOpen, setModalOpen] = useState(false)
  const [editing, setEditing] = useState<any>(null)
  const [form] = Form.useForm()

  const load = async () => {
    setLoading(true)
    try { setData(await listSources()) } catch {}
    setLoading(false)
  }

  useEffect(() => { load() }, [])

  const handleSave = async (values: any) => {
    try {
      if (editing) {
        await updateSource(editing.id, values)
        message.success('更新成功')
      } else {
        await createSource(values)
        message.success('创建成功')
      }
      setModalOpen(false)
      setEditing(null)
      form.resetFields()
      load()
    } catch (e: any) { message.error(e.message) }
  }

  const handleDelete = async (id: number) => {
    try {
      await deleteSource(id)
      message.success('删除成功')
      load()
    } catch (e: any) { message.error(e.message) }
  }

  const columns = [
    { title: '名称', dataIndex: 'name', key: 'name' },
    { title: '类型', dataIndex: 'source_type', key: 'source_type', render: (t: string) => ({ sqlite: 'SQLite 数据库', file: '单个文件', directory: '目录', glob: '通配匹配' })[t] || t },
    { title: '路径', dataIndex: 'path', key: 'path' },
    { title: '压缩', dataIndex: 'compress', key: 'compress', render: (v: boolean) => v ? '是' : '否' },
    { title: '启用', dataIndex: 'enabled', key: 'enabled', render: (v: boolean) => v ? '是' : '否' },
    { title: '排序', dataIndex: 'sort_order', key: 'sort_order' },
    {
      title: '操作', key: 'action',
      render: (_: any, record: any) => (
        <Space>
          <Button type="link" icon={<EditOutlined />} onClick={() => { setEditing(record); form.setFieldsValue({ ...record, compress: !!record.compress, db_vacuum: !!record.db_vacuum, enabled: !!record.enabled }); setModalOpen(true) }}>编辑</Button>
          <Popconfirm title="确定删除?" onConfirm={() => handleDelete(record.id)}>
            <Button type="link" danger icon={<DeleteOutlined />}>删除</Button>
          </Popconfirm>
        </Space>
      ),
    },
  ]

  const typeOptions = [
    { value: 'sqlite', label: 'SQLite 数据库' },
    { value: 'file', label: '单个文件' },
    { value: 'directory', label: '目录' },
    { value: 'glob', label: '通配匹配(Glob)' },
  ]

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 16 }}>
        <Title level={4}>备份源管理</Title>
        <Button type="primary" icon={<PlusOutlined />} onClick={() => { setEditing(null); form.resetFields(); setModalOpen(true) }}>添加备份源</Button>
      </div>
      <Table dataSource={data} columns={columns} rowKey="id" loading={loading} size="small" />

      <Modal title={editing ? '编辑备份源' : '添加备份源'} open={modalOpen} onCancel={() => { form.resetFields(); setModalOpen(false); setEditing(null) }} onOk={() => form.submit()}>
        <Form form={form} layout="vertical" onFinish={handleSave} initialValues={{ source_type: 'sqlite', compress: true, enabled: true, db_vacuum: true, sort_order: 0 }}>
          <Form.Item name="name" label="名称" rules={[{ required: true }]}>
            <Input placeholder="例如：用户数据库" />
          </Form.Item>
          <Form.Item name="source_type" label="类型" rules={[{ required: true }]}>
            <Select options={typeOptions} />
          </Form.Item>
          <Form.Item name="path" label="路径/匹配模式" rules={[{ required: true }]}>
            <Input placeholder="例如：C:\data\app.db 或 /data/*.db" />
          </Form.Item>
          <Form.Item name="db_vacuum" label="SQLite VACUUM 快照" valuePropName="checked">
            <Switch />
          </Form.Item>
          <Form.Item name="compress" label="打包压缩" valuePropName="checked">
            <Switch />
          </Form.Item>
          <Form.Item name="enabled" label="启用" valuePropName="checked">
            <Switch />
          </Form.Item>
          <Form.Item name="sort_order" label="排序">
            <Input type="number" />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  )
}
