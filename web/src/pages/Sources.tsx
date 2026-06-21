import { useEffect, useState } from 'react'
import { Table, Button, Modal, Form, Input, Select, Switch, Radio, Space, message, Popconfirm, Typography, Tag } from 'antd'
import { PlusOutlined, EditOutlined, DeleteOutlined, FolderOpenOutlined } from '@ant-design/icons'
import { listSources, createSource, updateSource, deleteSource } from '../api'
import FileBrowser from '../components/FileBrowser'

const { Title } = Typography
const { TextArea } = Input

export default function Sources() {
  const [data, setData] = useState<any[]>([])
  const [loading, setLoading] = useState(false)
  const [modalOpen, setModalOpen] = useState(false)
  const [editing, setEditing] = useState<any>(null)
  const [fileBrowserOpen, setFileBrowserOpen] = useState(false)
  const [pathsList, setPathsList] = useState<string[]>([])
  const [form] = Form.useForm()

  const load = async () => {
    setLoading(true)
    try { setData(await listSources()) } catch {}
    setLoading(false)
  }

  useEffect(() => { load() }, [])

  const getPathsList = (record: any): string[] => {
    if (record.paths) {
      try { return JSON.parse(record.paths) } catch {}
    }
    if (record.path) return [record.path]
    return []
  }

  const handleSave = async (values: any) => {
    try {
      const payload = { ...values, paths: JSON.stringify(pathsList) }
      if (editing) {
        await updateSource(editing.id, payload)
        message.success('更新成功')
      } else {
        await createSource(payload)
        message.success('创建成功')
      }
      setModalOpen(false)
      setEditing(null)
      form.resetFields()
      setPathsList([])
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
    {
      title: '路径', key: 'path',
      render: (_: any, record: any) => {
        const paths = getPathsList(record)
        return paths.length > 1 ? <span>{paths.length} 个路径{record.pack_mode === 'separate' ? ' (分别打包)' : ''}</span> : <span>{paths[0]}</span>
      }
    },
    { title: '压缩', dataIndex: 'compress', key: 'compress', render: (v: boolean) => v ? '是' : '否' },
    { title: '启用', dataIndex: 'enabled', key: 'enabled', render: (v: boolean) => v ? '是' : '否' },
    { title: '排序', dataIndex: 'sort_order', key: 'sort_order' },
    {
      title: '操作', key: 'action',
      render: (_: any, record: any) => (
        <Space>
          <Button type="link" icon={<EditOutlined />} onClick={() => {
            setEditing(record)
            setPathsList(getPathsList(record))
            form.setFieldsValue({ name: record.name, source_type: record.source_type, pack_mode: record.pack_mode || 'bundle', db_vacuum: !!record.db_vacuum, compress: !!record.compress, enabled: !!record.enabled, sort_order: record.sort_order })
            setModalOpen(true)
          }}>编辑</Button>
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

  const addPath = (p: string) => {
    if (p && !pathsList.includes(p)) {
      setPathsList([...pathsList, p])
    }
  }

  const removePath = (p: string) => {
    setPathsList(pathsList.filter(x => x !== p))
  }

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 16 }}>
        <Title level={4}>备份源管理</Title>
        <Button type="primary" icon={<PlusOutlined />} onClick={() => { setEditing(null); form.resetFields(); setPathsList([]); setModalOpen(true) }}>添加备份源</Button>
      </div>
      <Table dataSource={data} columns={columns} rowKey="id" loading={loading} size="small" />

      <Modal title={editing ? '编辑备份源' : '添加备份源'} open={modalOpen} onCancel={() => { form.resetFields(); setModalOpen(false); setEditing(null); setPathsList([]) }} onOk={() => form.submit()} width={600}>
        <Form form={form} layout="vertical" onFinish={handleSave} initialValues={{ source_type: 'file', pack_mode: 'bundle', compress: true, enabled: true, db_vacuum: true, sort_order: 0 }}>
          <Form.Item name="name" label="名称" rules={[{ required: true }]}>
            <Input placeholder="例如：项目1" />
          </Form.Item>
          <Form.Item name="source_type" label="类型" rules={[{ required: true }]}>
            <Select options={typeOptions} onChange={(v) => { if (v === 'sqlite') setPathsList(pathsList.slice(0, 1)) }} />
          </Form.Item>
          <Form.Item label="路径列表">
            <Space direction="vertical" style={{ width: '100%' }}>
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                {pathsList.map(p => (
                  <Tag key={p} closable onClose={() => removePath(p)} style={{ maxWidth: 300, overflow: 'hidden', textOverflow: 'ellipsis' }}>{p}</Tag>
                ))}
              </div>
              <div style={{ display: 'flex', gap: 8 }}>
                <Input
                  placeholder="输入路径后按回车添加"
                  onPressEnter={(e) => { addPath((e.target as HTMLInputElement).value); (e.target as HTMLInputElement).value = '' }}
                  style={{ flex: 1 }}
                />
                <Button icon={<FolderOpenOutlined />} onClick={() => setFileBrowserOpen(true)}>浏览</Button>
              </div>
            </Space>
          </Form.Item>
          <FileBrowser
            visible={fileBrowserOpen}
            onClose={() => setFileBrowserOpen(false)}
            onSelect={(p) => { addPath(p); setFileBrowserOpen(false) }}
            selectDir={true}
            selectFile={true}
          />
          <Form.Item name="pack_mode" label="打包方式">
            <Radio.Group>
              <Radio value="bundle">合成一个包</Radio>
              <Radio value="separate">分别打包</Radio>
            </Radio.Group>
          </Form.Item>
          {form.getFieldValue('source_type') === 'sqlite' && (
            <Form.Item name="db_vacuum" label="SQLite VACUUM 快照" valuePropName="checked">
              <Switch />
            </Form.Item>
          )}
          <Form.Item name="compress" label="打包压缩(tar.gz)" valuePropName="checked">
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
