import { useEffect, useState } from 'react'
import { Card, Row, Col, Statistic, Table, Tag, Typography } from 'antd'
import { DatabaseOutlined, CloudUploadOutlined, ScheduleOutlined, FileTextOutlined } from '@ant-design/icons'
import { getDashboardStats } from '../api'
import dayjs from 'dayjs'

const { Title } = Typography

export default function Dashboard() {
  const [stats, setStats] = useState<any>({})

  useEffect(() => {
    getDashboardStats().then(setStats).catch(() => {})
  }, [])

  const recentColumns = [
    { title: '任务', dataIndex: 'job_id', key: 'job_id' },
    { title: '状态', dataIndex: 'status', key: 'status', render: (s: string) => (
      <Tag color={s === 'success' ? 'green' : s === 'failed' ? 'red' : 'blue'}>{s === 'success' ? '成功' : s === 'failed' ? '失败' : '运行中'}</Tag>
    )},
    { title: '时间', dataIndex: 'started_at', key: 'started_at', render: (t: string) => t ? dayjs(t).format('MM-DD HH:mm') : '-' },
    { title: '文件数', dataIndex: 'file_count', key: 'file_count' },
    { title: '大小', dataIndex: 'size_bytes', key: 'size_bytes', render: (s: number) => s ? (s / 1024 / 1024).toFixed(2) + ' MB' : '-' },
  ]

  return (
    <div>
      <Title level={4}>系统概览</Title>
      <Row gutter={[16, 16]} style={{ marginBottom: 24 }}>
        <Col span={6}><Card><Statistic title="备份任务" value={stats.job_count || 0} prefix={<ScheduleOutlined />} /></Card></Col>
        <Col span={6}><Card><Statistic title="备份源" value={stats.source_count || 0} prefix={<DatabaseOutlined />} /></Card></Col>
        <Col span={6}><Card><Statistic title="备份目标" value={stats.dest_count || 0} prefix={<CloudUploadOutlined />} /></Card></Col>
        <Col span={6}><Card><Statistic title="执行次数" value={stats.total_logs || 0} prefix={<FileTextOutlined />} /></Card></Col>
      </Row>
      <Card title="最近执行">
        <Table
          dataSource={stats.recent_executions || []}
          columns={recentColumns}
          rowKey="id"
          pagination={false}
          size="small"
        />
      </Card>
    </div>
  )
}
