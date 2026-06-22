import { useEffect, useState, useRef } from 'react'
import { Table, Button, Modal, Form, Input, Select, Switch, Radio, Space, message, Popconfirm, Typography, Tooltip } from 'antd'
import { PlusOutlined, EditOutlined, DeleteOutlined, FolderOpenOutlined, DatabaseOutlined, FileOutlined, FolderOutlined, InfoCircleOutlined, ArrowRightOutlined } from '@ant-design/icons'
import { listSources, createSource, updateSource, deleteSource } from '../api'
import FileBrowser from '../components/FileBrowser'

const { Title, Text } = Typography

interface PathItem {
  path: string
  type: string
  isDir?: boolean
}

export default function Sources() {
  const [data, setData] = useState<any[]>([])
  const [loading, setLoading] = useState(false)
  const [modalOpen, setModalOpen] = useState(false)
  const [editing, setEditing] = useState<any>(null)
  const [fileBrowserOpen, setFileBrowserOpen] = useState(false)
  const [pathsList, setPathsList] = useState<PathItem[]>([])
  const [browsePath, setBrowsePath] = useState('')
  const [showHint, setShowHint] = useState(false)
  const hintTimer = useRef<ReturnType<typeof setTimeout>>()
  const [form] = Form.useForm()

  const load = async () => {
    setLoading(true)
    try { setData(await listSources()) } catch {}
    setLoading(false)
  }

  useEffect(() => { load() }, [])

  const parsePaths = (record: any): PathItem[] => {
    let raw = ''
    if (record.paths) raw = record.paths
    else if (record.path) return [{ path: record.path, type: record.source_type || 'file' }]
    else return []
    try {
      const arr = JSON.parse(raw)
      if (!Array.isArray(arr)) return []
      return arr.map((item: any) => {
        if (typeof item === 'string') return { path: item, type: record.source_type || 'file' }
        return { path: item.path || '', type: item.type || 'file' }
      }).filter((x: PathItem) => x.path)
    } catch { return [] }
  }

  const handleSave = async (values: any) => {
    try {
      if (pathsList.length === 0) {
        message.error('请至少添加一个路径')
        return
      }
      const cleaned = pathsList.map(p => ({ path: p.path, type: p.type }))
      const payload = { ...values, paths: JSON.stringify(cleaned), path: '' }
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

  const togglePathType = (idx: number) => {
    setPathsList(prev => {
      const next = [...prev]
      next[idx] = { ...next[idx], type: next[idx].type === 'sqlite' ? 'file' : 'sqlite' }
      return next
    })
  }

  const columns = [
    { title: '名称', dataIndex: 'name', key: 'name' },
    {
      title: '路径', key: 'path',
      render: (_: any, record: any) => {
        const paths = parsePaths(record)
        const dbCount = paths.filter((p: PathItem) => p.type === 'sqlite').length
        if (paths.length === 1) return <span>{paths[0].path}{paths[0].type === 'sqlite' ? ' (DB)' : ''}</span>
        return <span>{paths.length} 个路径{dbCount > 0 ? ` (${dbCount} DB)` : ''}{record.pack_mode === 'separate' ? ' · 分别打包' : ''}</span>
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
            setPathsList(parsePaths(record))
            form.setFieldsValue({ name: record.name, source_type: record.source_type, pack_mode: record.pack_mode || 'bundle', compress: !!record.compress, enabled: !!record.enabled, sort_order: record.sort_order })
            setModalOpen(true)
          }}>编辑</Button>
          <Popconfirm title="确定删除?" onConfirm={() => handleDelete(record.id)}>
            <Button type="link" danger icon={<DeleteOutlined />}>删除</Button>
          </Popconfirm>
        </Space>
      ),
    },
  ]

  const addPath = (p: string, isDir?: boolean) => {
    if (p && !pathsList.some(x => x.path === p)) {
      const next = [...pathsList, { path: p, type: 'file', isDir }]
      setPathsList(next)
      if (next.length === 1) {
        setShowHint(true)
        clearTimeout(hintTimer.current)
        hintTimer.current = setTimeout(() => setShowHint(false), 6000)
      }
    }
  }

  useEffect(() => {
    return () => clearTimeout(hintTimer.current)
  }, [])

  const removePath = (idx: number) => {
    setPathsList((pathsList || []).filter((_, i) => i !== idx))
  }

  return (
    <div>
      <style>{`
        @keyframes blink-hint {
          0%, 100% { opacity: 0; transform: translateX(-4px); }
          50% { opacity: 1; transform: translateX(0); }
        }
      `}</style>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 16 }}>
        <Title level={4}>备份源管理</Title>
        <Button type="primary" icon={<PlusOutlined />} onClick={() => { setEditing(null); form.resetFields(); setPathsList([]); setShowHint(false); clearTimeout(hintTimer.current); setModalOpen(true) }}>添加备份源</Button>
      </div>
      <Table dataSource={data || []} columns={columns} rowKey="id" loading={loading} size="small" />

      <Modal title={editing ? '编辑备份源' : '添加备份源'} open={modalOpen} onCancel={() => { form.resetFields(); setModalOpen(false); setEditing(null); setPathsList([]) }} onOk={() => form.submit()} width={640}>
        <Form form={form} layout="vertical" onFinish={handleSave} initialValues={{ source_type: 'file', pack_mode: 'bundle', compress: true, enabled: true, sort_order: 0 }}>
          <Form.Item name="name" label="名称" rules={[{ required: true }]}>
            <Input placeholder="例如：项目1" />
          </Form.Item>
          <Form.Item name="source_type" initialValue="file" hidden>
            <Input />
          </Form.Item>
          <Form.Item label={<span>路径列表 <Tooltip title='点击路径左侧的"文件/数据库"按钮可切换备份方式（数据库使用 VACUUM INTO 快照，文件直接打包）'><InfoCircleOutlined style={{ color: '#999' }} /></Tooltip></span>}>
            <Space direction="vertical" style={{ width: '100%' }}>
              {(pathsList || []).map((item, idx) => (
                <div key={idx} style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                  {idx === 0 && showHint && !item.isDir && (
                    <span style={{ animation: 'blink-hint 0.8s ease-in-out infinite', color: '#1890ff', fontSize: 12, whiteSpace: 'nowrap' }}>
                      点此切换 <ArrowRightOutlined />
                    </span>
                  )}
                  {item.isDir ? (
                    <Tooltip title="目录路径会被自动打包成 tar.gz（不受压缩开关控制）">
                      <Button size="small" style={{ width: 80, color: '#faad14', borderColor: '#faad14' }} icon={<FolderOutlined />}>目录</Button>
                    </Tooltip>
                  ) : (
                    <Tooltip title={item.type === 'sqlite' ? '使用 VACUUM INTO 快照备份' : '文件直接打包'}>
                      <Button size="small" type={item.type === 'sqlite' ? 'primary' : 'default'} icon={item.type === 'sqlite' ? <DatabaseOutlined /> : <FileOutlined />} onClick={() => { togglePathType(idx); setShowHint(false) }} style={{ width: 80 }}>
                        {item.type === 'sqlite' ? '数据库' : '文件'}
                      </Button>
                    </Tooltip>
                  )}
                  <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', fontSize: 13 }}>{item.path}</span>
                  <Button size="small" danger type="text" onClick={() => removePath(idx)}>×</Button>
                </div>
              ))}
              <div style={{ display: 'flex', gap: 8 }}>
                <Input
                  placeholder="输入路径后按回车添加"
                  onPressEnter={(e) => { addPath((e.target as HTMLInputElement).value); (e.target as HTMLInputElement).value = '' }}
                  style={{ flex: 1 }}
                />
                <Button icon={<FolderOpenOutlined />} onClick={() => {
                  if (pathsList.length > 0) {
                    const last = pathsList[pathsList.length-1].path
                    setBrowsePath(last.includes('.') ? last.replace(/\\[^\\]+$/, '').replace(/\/[^/]+$/, '') : last)
                  }
                  setFileBrowserOpen(true)
                }}>浏览</Button>
              </div>
            </Space>
          </Form.Item>
          <FileBrowser
            visible={fileBrowserOpen}
            onClose={() => setFileBrowserOpen(false)}
            onSelect={(p, isDir) => { addPath(p, isDir); setBrowsePath(p); setFileBrowserOpen(false) }}
            selectDir={true}
            selectFile={true}
            defaultPath={browsePath}
          />
          <Form.Item name="pack_mode" label="打包方式">
            <Radio.Group>
              <Radio value="bundle">合成一个包</Radio>
              <Radio value="separate">分别打包</Radio>
            </Radio.Group>
          </Form.Item>
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
