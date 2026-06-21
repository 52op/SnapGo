import { useEffect, useState } from 'react'
import { Modal, List, Button, Space, Typography, Spin, message, Tag } from 'antd'
import { FolderOutlined, FileOutlined, ArrowUpOutlined } from '@ant-design/icons'
import { browsePath } from '../api'

const { Text } = Typography

interface FileEntry {
  name: string
  is_dir: boolean
  size: number
  mod_time: string
  path: string
}

interface Props {
  visible: boolean
  onClose: () => void
  onSelect: (path: string) => void
  selectDir?: boolean
  selectFile?: boolean
}

export default function FileBrowser({ visible, onClose, onSelect, selectDir, selectFile }: Props) {
  const [currentPath, setCurrentPath] = useState('')
  const [entries, setEntries] = useState<FileEntry[]>([])
  const [loading, setLoading] = useState(false)
  const [history, setHistory] = useState<string[]>([])
  const [selectedFile, setSelectedFile] = useState<string | null>(null)

  const loadPath = async (path: string) => {
    setLoading(true)
    setSelectedFile(null)
    try {
      setEntries(await browsePath(path))
      setCurrentPath(path)
    } catch (e: any) {
      message.error('读取目录失败: ' + e.message)
    }
    setLoading(false)
  }

  useEffect(() => {
    if (visible) {
      loadPath('')
      setHistory([])
    }
  }, [visible])

  const enterDir = (dir: FileEntry) => {
    setHistory(h => [...h, currentPath])
    loadPath(dir.path)
  }

  const goUp = () => {
    if (history.length === 0) return
    const prev = history[history.length - 1]
    setHistory(h => h.slice(0, -1))
    loadPath(prev)
  }

  const handleSelect = () => {
    if (selectedFile) {
      onSelect(selectedFile)
    } else {
      onSelect(currentPath)
    }
    onClose()
  }

  const dirs = entries.filter(e => e.is_dir)
  const files = entries.filter(e => !e.is_dir)

  return (
    <Modal title="浏览服务器文件" open={visible} onCancel={onClose} footer={null} width={640} destroyOnClose>
      <div style={{ marginBottom: 12, display: 'flex', alignItems: 'center', gap: 8 }}>
        <Button size="small" icon={<ArrowUpOutlined />} disabled={history.length === 0} onClick={goUp}>上级</Button>
        <Text ellipsis style={{ flex: 1, fontSize: 13 }} code>{currentPath || '(根目录)'}</Text>
      </div>
      <Spin spinning={loading}>
        <div style={{ maxHeight: 400, overflow: 'auto', border: '1px solid #f0f0f0', borderRadius: 6 }}>
          {dirs.length === 0 && files.length === 0 && !loading && (
            <div style={{ padding: 24, textAlign: 'center', color: '#999' }}>空目录</div>
          )}
          {dirs.map(entry => (
            <div
              key={entry.path}
              style={{ padding: '6px 12px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 8, background: selectedFile === entry.path ? '#e6f7ff' : undefined }}
              onDoubleClick={() => enterDir(entry)}
              onClick={() => { if (selectDir) setSelectedFile(entry.path) }}
            >
              <FolderOutlined style={{ color: '#faad14' }} />
              <Text>{entry.name}</Text>
              <Tag style={{ marginLeft: 'auto' }}>目录</Tag>
            </div>
          ))}
          {files.map(entry => (
            <div
              key={entry.path}
              style={{ padding: '6px 12px', cursor: selectFile ? 'pointer' : undefined, display: 'flex', alignItems: 'center', gap: 8, background: selectedFile === entry.path ? '#e6f7ff' : undefined }}
              onClick={() => { if (selectFile) setSelectedFile(entry.path) }}
            >
              <FileOutlined style={{ color: '#1890ff' }} />
              <Text>{entry.name}</Text>
              <Text type="secondary" style={{ fontSize: 12 }}>{entry.size > 1024 ? `${(entry.size / 1024).toFixed(1)} KB` : `${entry.size} B`}</Text>
            </div>
          ))}
        </div>
      </Spin>
      <div style={{ marginTop: 12, textAlign: 'right' }}>
        <Space>
          <Button onClick={onClose}>取消</Button>
          <Button type="primary" onClick={handleSelect} disabled={!selectedFile && currentPath === ''}>
            {selectedFile ? '选择此文件/目录' : (selectDir ? '选择当前目录' : '选择')}
          </Button>
        </Space>
      </div>
    </Modal>
  )
}
