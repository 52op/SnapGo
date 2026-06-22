import { useEffect, useState, useRef, Fragment } from 'react'
import { Modal, Button, Space, Typography, Spin, message, Tag, Dropdown, Input } from 'antd'
import { FolderOutlined, FileOutlined, ArrowUpOutlined, SearchOutlined } from '@ant-design/icons'
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
  onSelect: (path: string, isDir: boolean) => void
  selectDir?: boolean
  selectFile?: boolean
  defaultPath?: string
}

export default function FileBrowser({ visible, onClose, onSelect, selectDir, selectFile, defaultPath }: Props) {
  const [currentPath, setCurrentPath] = useState('')
  const [entries, setEntries] = useState<FileEntry[]>([])
  const [loading, setLoading] = useState(false)
  const [history, setHistory] = useState<string[]>([])
  const [selectedFile, setSelectedFile] = useState<{ path: string; isDir: boolean } | null>(null)
  const [editing, setEditing] = useState(false)
  const [editPath, setEditPath] = useState('')
  const [searchText, setSearchText] = useState('')
  const [dropdownSegIdx, setDropdownSegIdx] = useState<number | null>(null)
  const [siblingEntries, setSiblingEntries] = useState<FileEntry[]>([])
  const [siblingLoading, setSiblingLoading] = useState(false)
  const lastPathRef = useRef('')
  const editInputRef = useRef<any>(null)

  const loadPath = async (path: string) => {
    setLoading(true)
    setSelectedFile(null)
    setDropdownSegIdx(null)
    try {
      const result = await browsePath(path)
      setEntries(result || [])
      setCurrentPath(path)
    } catch (e: any) {
      setEntries([])
      message.error('读取目录失败: ' + e.message)
    }
    setLoading(false)
  }

  useEffect(() => {
    if (visible) {
      loadPath(defaultPath || lastPathRef.current || '')
      setHistory([])
    } else {
      lastPathRef.current = currentPath
    }
  }, [visible])

  useEffect(() => {
    if (editing && editInputRef.current) {
      editInputRef.current.focus()
    }
  }, [editing])

  const enterDir = (dir: FileEntry) => {
    setHistory(h => [...h, currentPath])
    loadPath(dir.path)
  }

  const goUp = () => {
    if (history.length === 0) {
      if (!currentPath) return
      const parent = currentPath.replace(/[/\\][^/\\]+$/, '')
      if (parent && parent !== currentPath) {
        loadPath(/^[a-zA-Z]:$/.test(parent) ? parent + '\\' : parent)
      }
      return
    }
    const prev = history[history.length - 1]
    setHistory(h => h.slice(0, -1))
    loadPath(prev)
  }

  const navigateTo = (path: string) => {
    setHistory(h => [...h, currentPath])
    loadPath(path)
  }

  const handleSelect = () => {
    if (selectedFile) {
      onSelect(selectedFile.path, selectedFile.isDir)
    } else {
      onSelect(currentPath, true)
    }
    onClose()
  }

  const dirs = entries.filter(e => e.is_dir)
  const files = entries.filter(e => !e.is_dir)
  const filteredDirs = searchText ? dirs.filter(d => d.name.toLowerCase().includes(searchText.toLowerCase())) : dirs
  const filteredFiles = searchText ? files.filter(f => f.name.toLowerCase().includes(searchText.toLowerCase())) : files

  const pathSegments = () => {
    if (!currentPath) return null
    const segs: { label: string; path: string; parentPath: string; isRoot: boolean }[] = []

    if (/^[a-zA-Z]:\\/.test(currentPath)) {
      const drive = currentPath.substring(0, 3)
      segs.push({ label: drive, path: drive, parentPath: '', isRoot: true })
      const rest = currentPath.substring(3).replace(/\\$/, '').split('\\').filter(Boolean)
      let acc = drive
      for (const part of rest) {
        const parentPath = acc
        acc += part + '\\'
        segs.push({ label: part, path: acc, parentPath, isRoot: false })
      }
    } else {
      segs.push({ label: '/', path: '/', parentPath: '', isRoot: true })
      const parts = currentPath.split('/').filter(Boolean)
      let acc = '/'
      for (const part of parts) {
        const parentPath = acc
        acc += (acc === '/' ? '' : '/') + part
        segs.push({ label: part, path: acc, parentPath, isRoot: false })
      }
    }
    return segs
  }

  const loadSiblings = async (segIndex: number) => {
    const segments = pathSegments()
    if (!segments || segIndex >= segments.length) return
    const seg = segments[segIndex]
    setSiblingLoading(true)
    try {
      const pathToFetch = seg.isRoot ? '' : seg.parentPath
      const result = await browsePath(pathToFetch)
      setSiblingEntries(result?.filter((e: FileEntry) => e.is_dir) || [])
    } catch {
      setSiblingEntries([])
    }
    setSiblingLoading(false)
  }

  const handleDropdownToggle = (segIndex: number) => {
    if (dropdownSegIdx === segIndex) {
      setDropdownSegIdx(null)
    } else {
      setDropdownSegIdx(segIndex)
      loadSiblings(segIndex)
    }
  }

  const segments = pathSegments()

  const renderDropdown = (segIndex: number) => (
    <div style={{ background: 'white', border: '1px solid #d9d9d9', borderRadius: 4, boxShadow: '0 2px 8px rgba(0,0,0,0.15)', maxHeight: 300, overflow: 'auto', minWidth: 150, padding: '4px 0' }}>
      {siblingLoading ? (
        <div style={{ padding: '8px 12px' }}><Spin size="small" /></div>
      ) : siblingEntries.length === 0 ? (
        <div style={{ padding: '8px 12px', color: '#999', fontSize: 12 }}>无子目录</div>
      ) : siblingEntries.map(entry => (
        <div
          key={entry.path}
          style={{ padding: '4px 12px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 8, fontSize: 13 }}
          onClick={() => { navigateTo(entry.path); setDropdownSegIdx(null) }}
          onMouseEnter={e => e.currentTarget.style.background = '#f0f0f0'}
          onMouseLeave={e => e.currentTarget.style.background = ''}
        >
          <FolderOutlined style={{ color: '#faad14' }} />
          <Text>{entry.name}</Text>
        </div>
      ))}
    </div>
  )

  return (
    <Modal title="浏览服务器文件" open={visible} onCancel={onClose} footer={null} width={640} destroyOnClose>
      <div style={{ marginBottom: 8, display: 'flex', alignItems: 'center', gap: 4 }}>
        <Button size="small" icon={<ArrowUpOutlined />} disabled={history.length === 0 && !currentPath} onClick={goUp}>上级</Button>
        <div style={{ flex: 1, overflow: 'hidden', display: 'flex', alignItems: 'center', background: '#f5f5f5', border: '1px solid #d9d9d9', borderRadius: 4, padding: '2px 8px', minHeight: 30, gap: 0 }}>
          {editing ? (
            <Input
              ref={editInputRef}
              value={editPath}
              onChange={e => setEditPath(e.target.value)}
              onPressEnter={() => { if (editPath.trim()) loadPath(editPath.trim()); setEditing(false) }}
              onPressEscape={() => setEditing(false)}
              onBlur={() => setEditing(false)}
              bordered={false}
              style={{ padding: 0, background: 'transparent', fontSize: 13 }}
            />
          ) : (
            <div style={{ flex: 1, overflow: 'hidden', cursor: 'text' }} onClick={() => { setEditing(true); setEditPath(currentPath) }}>
              {segments ? segments.map((seg, i) => (
                <Fragment key={i}>
                  {i > 0 && (
                    <Dropdown
                      trigger={['click']}
                      open={dropdownSegIdx === i}
                      onOpenChange={(open) => { if (!open) setDropdownSegIdx(null) }}
                      dropdownRender={() => renderDropdown(i)}
                    >
                      <span
                        style={{ cursor: 'pointer', color: '#1890ff', fontSize: 13, padding: '0 1px', userSelect: 'none' }}
                        onClick={(e) => { e.stopPropagation(); handleDropdownToggle(i) }}
                      >{`>`}</span>
                    </Dropdown>
                  )}
                  <span
                    style={{ cursor: 'pointer', color: '#1890ff', fontSize: 13, padding: '0 2px' }}
                    onClick={(e) => { e.stopPropagation(); navigateTo(seg.path) }}
                  >{seg.label}</span>
                </Fragment>
              )) : <Text style={{ fontSize: 13, color: '#999' }}>根目录</Text>}
            </div>
          )}
        </div>
        <Input
          placeholder="搜索"
          prefix={<SearchOutlined style={{ color: '#bbb' }} />}
          value={searchText}
          onChange={e => setSearchText(e.target.value)}
          allowClear
          size="small"
          style={{ width: 120, flexShrink: 0 }}
        />
      </div>
      <Spin spinning={loading}>
        <div style={{ maxHeight: 400, overflow: 'auto', border: '1px solid #f0f0f0', borderRadius: 6 }}>
          {filteredDirs.length === 0 && filteredFiles.length === 0 && !loading && (
            <div style={{ padding: 24, textAlign: 'center', color: '#999' }}>
              {searchText ? '未找到匹配项' : '空目录'}
            </div>
          )}
          {filteredDirs.map(entry => (
            <div
              key={entry.path}
              style={{ padding: '6px 12px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 8, background: selectedFile?.path === entry.path ? '#e6f7ff' : undefined }}
              onDoubleClick={() => enterDir(entry)}
              onClick={() => { if (selectDir) setSelectedFile({ path: entry.path, isDir: true }) }}
            >
              <FolderOutlined style={{ color: '#faad14' }} />
              <Text>{entry.name}</Text>
              <Tag style={{ marginLeft: 'auto' }}>目录</Tag>
            </div>
          ))}
          {filteredFiles.map(entry => (
            <div
              key={entry.path}
              style={{ padding: '6px 12px', cursor: selectFile ? 'pointer' : undefined, display: 'flex', alignItems: 'center', gap: 8, background: selectedFile?.path === entry.path ? '#e6f7ff' : undefined }}
              onClick={() => { if (selectFile) setSelectedFile({ path: entry.path, isDir: false }) }}
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
            {selectedFile ? '选择此文件/目录' : '选择'}
          </Button>
        </Space>
      </div>
    </Modal>
  )
}