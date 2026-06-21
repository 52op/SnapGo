import { useEffect, useState } from 'react'
import { Table, Button, Tag, Typography, Space, Popconfirm, message, Modal, Select, InputNumber } from 'antd'
import { ReloadOutlined, DeleteOutlined, EyeOutlined } from '@ant-design/icons'
import { listLogs, deleteLog, getLog, listJobs } from '../api'
import dayjs from 'dayjs'

const { Title, Paragraph } = Typography

export default function Logs() {
  const [data, setData] = useState<any[]>([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(50)
  const [loading, setLoading] = useState(false)
  const [jobs, setJobs] = useState<any[]>([])
  const [filterJobId, setFilterJobId] = useState<number | undefined>()
  const [detailOpen, setDetailOpen] = useState(false)
  const [detail, setDetail] = useState<any>(null)

  const load = async () => {
    setLoading(true)
    try {
      const params: any = { page, page_size: pageSize }
      if (filterJobId) params.job_id = filterJobId
      const res = await listLogs(params)
      setData(res.items || [])
      setTotal(res.total || 0)
    } catch {}
    setLoading(false)
  }

  useEffect(() => { load() }, [page, pageSize, filterJobId])
  useEffect(() => { listJobs().then(setJobs).catch(() => {}) }, [])

  const handleDelete = async (id: number) => {
    try { await deleteLog(id); message.success('已删除'); load() }
    catch (e: any) { message.error(e.message) }
  }

  const showDetail = async (id: number) => {
    try {
      const log = await getLog(id)
      setDetail(log)
      setDetailOpen(true)
    } catch (e: any) { message.error(e.message) }
  }

  const columns = [
    { title: 'ID', dataIndex: 'id', key: 'id', width: 60 },
    { title: '任务', dataIndex: 'job_id', key: 'job_id', width: 80 },
    { title: '状态', dataIndex: 'status', key: 'status', width: 80, render: (s: string) => (
      <Tag color={s === 'success' ? 'green' : s === 'failed' ? 'red' : 'processing'}>{s === 'success' ? '成功' : s === 'failed' ? '失败' : '运行中'}</Tag>
    )},
    { title: '开始时间', dataIndex: 'started_at', key: 'started_at', render: (t: string) => t ? dayjs(t).format('YYYY-MM-DD HH:mm:ss') : '-' },
    { title: '结束时间', dataIndex: 'ended_at', key: 'ended_at', render: (t: string) => t ? dayjs(t).format('YYYY-MM-DD HH:mm:ss') : '-' },
    { title: '文件数', dataIndex: 'file_count', key: 'file_count' },
    { title: '大小', dataIndex: 'size_bytes', key: 'size_bytes', render: (s: number) => s ? (s / 1024 / 1024).toFixed(2) + ' MB' : '-' },
    {
      title: '操作', key: 'action', width: 120,
      render: (_: any, record: any) => (
        <Space>
          <Button type="link" size="small" icon={<EyeOutlined />} onClick={() => showDetail(record.id)}>详情</Button>
          <Popconfirm title="确定删除?" onConfirm={() => handleDelete(record.id)}>
            <Button type="link" size="small" danger icon={<DeleteOutlined />}>删除</Button>
          </Popconfirm>
        </Space>
      ),
    },
  ]

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 16, alignItems: 'center' }}>
        <Title level={4} style={{ margin: 0 }}>执行日志</Title>
        <Space>
          <Select
            allowClear
            placeholder="按任务筛选"
            style={{ width: 200 }}
            options={(jobs || []).map((j: any) => ({ value: j.id, label: j.name }))}
            onChange={(v) => { setFilterJobId(v); setPage(1) }}
          />
          <Button icon={<ReloadOutlined />} onClick={load}>刷新</Button>
        </Space>
      </div>
      <Table
        dataSource={data}
        columns={columns}
        rowKey="id"
        loading={loading}
        size="small"
        pagination={{
          current: page,
          pageSize,
          total,
          onChange: (p: number, ps: number) => { setPage(p); setPageSize(ps) },
          showSizeChanger: true,
          showTotal: (t: number) => `共 ${t} 条`,
        }}
      />

      <Modal title="执行详情" open={detailOpen} onCancel={() => { setDetailOpen(false); setDetail(null) }} footer={null} width={800}>
        {detail && (
          <div>
            <Paragraph><strong>状态：</strong><Tag color={detail.status === 'success' ? 'green' : 'red'}>{detail.status === 'success' ? '成功' : detail.status === 'failed' ? '失败' : '运行中'}</Tag></Paragraph>
            <Paragraph><strong>文件数：</strong>{detail.file_count || 0}</Paragraph>
            <Paragraph><strong>总大小：</strong>{(detail.size_bytes || 0) / 1024 / 1024 > 0 ? ((detail.size_bytes || 0) / 1024 / 1024).toFixed(2) + ' MB' : '0 B'}</Paragraph>
            <Paragraph><strong>开始：</strong>{detail.started_at ? dayjs(detail.started_at).format('YYYY-MM-DD HH:mm:ss') : '-'}</Paragraph>
            <Paragraph><strong>结束：</strong>{detail.ended_at ? dayjs(detail.ended_at).format('YYYY-MM-DD HH:mm:ss') : '-'}</Paragraph>
            {detail.error && <Paragraph><strong>错误：</strong><pre style={{ background: '#fff2f0', padding: 12, borderRadius: 6, whiteSpace: 'pre-wrap' }}>{detail.error}</pre></Paragraph>}
            {detail.output && (
              <>
                <Paragraph><strong>输出：</strong></Paragraph>
                <pre style={{ background: '#f6f8fa', padding: 12, borderRadius: 6, whiteSpace: 'pre-wrap', maxHeight: 400, overflow: 'auto' }}>{detail.output}</pre>
              </>
            )}
          </div>
        )}
      </Modal>
    </div>
  )
}
