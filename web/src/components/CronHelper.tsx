import { useState } from 'react'
import { Modal, Select, InputNumber, Checkbox, Space, Typography, Row, Col } from 'antd'
import { ClockCircleOutlined } from '@ant-design/icons'

const { Text } = Typography

const WEEK_DAYS = [
  { label: '周日', value: 0 },
  { label: '周一', value: 1 },
  { label: '周二', value: 2 },
  { label: '周三', value: 3 },
  { label: '周四', value: 4 },
  { label: '周五', value: 5 },
  { label: '周六', value: 6 },
]

interface Props {
  visible: boolean
  onClose: () => void
  onSelect: (cron: string) => void
}

export default function CronHelper({ visible, onClose, onSelect }: Props) {
  const [type, setType] = useState('daily')
  const [minute, setMinute] = useState(0)
  const [hour, setHour] = useState(3)
  const [dayOfMonth, setDayOfMonth] = useState(1)
  const [weekDays, setWeekDays] = useState<number[]>([1, 2, 3, 4, 5])

  const generate = (): string => {
    switch (type) {
      case 'every_min':
        return '* * * * *'
      case 'every_hour':
        return `${minute} * * * *`
      case 'daily':
        return `${minute} ${hour} * * *`
      case 'weekly':
        if (weekDays.length === 0) return `${minute} ${hour} * * *`
        return `${minute} ${hour} * * ${weekDays.sort().join(',')}`
      case 'monthly':
        return `${minute} ${hour} ${dayOfMonth} * *`
      default:
        return '* * * * *'
    }
  }

  const preview = (): string => {
    switch (type) {
      case 'every_min': return '每分钟执行一次'
      case 'every_hour': return `每小时的第 ${minute} 分钟执行`
      case 'daily': return `每天 ${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')} 执行`
      case 'weekly': {
        const days = weekDays.map(d => WEEK_DAYS.find(w => w.value === d)?.label).filter(Boolean).join('、')
        return `每周 ${days} 的 ${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')} 执行`
      }
      case 'monthly': return `每月第 ${dayOfMonth} 天 ${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')} 执行`
      default: return ''
    }
  }

  const handleOk = () => {
    onSelect(generate())
    onClose()
  }

  return (
    <Modal title={<><ClockCircleOutlined /> Cron 表达式助手</>} open={visible} onCancel={onClose} onOk={handleOk} okText="应用" width={480}>
      <Space direction="vertical" style={{ width: '100%' }} size="middle">
        <div>
          <Text strong>执行频率</Text>
          <Select value={type} onChange={setType} style={{ width: '100%', marginTop: 4 }}>
            <Select.Option value="every_min">每分钟</Select.Option>
            <Select.Option value="every_hour">每小时</Select.Option>
            <Select.Option value="daily">每天</Select.Option>
            <Select.Option value="weekly">每周</Select.Option>
            <Select.Option value="monthly">每月</Select.Option>
          </Select>
        </div>

        {type !== 'every_min' && (
          <Row gutter={16}>
            <Col span={12}>
              <Text strong>分钟 (0-59)</Text>
              <InputNumber min={0} max={59} value={minute} onChange={v => setMinute(v ?? 0)} style={{ width: '100%', marginTop: 4 }} />
            </Col>
            {(type === 'daily' || type === 'weekly' || type === 'monthly') && (
              <Col span={12}>
                <Text strong>小时 (0-23)</Text>
                <InputNumber min={0} max={23} value={hour} onChange={v => setHour(v ?? 0)} style={{ width: '100%', marginTop: 4 }} />
              </Col>
            )}
          </Row>
        )}

        {type === 'monthly' && (
          <div>
            <Text strong>日期 (1-31)</Text>
            <InputNumber min={1} max={31} value={dayOfMonth} onChange={v => setDayOfMonth(v ?? 1)} style={{ width: '100%', marginTop: 4 }} />
          </div>
        )}

        {type === 'weekly' && (
          <div>
            <Text strong>星期</Text>
            <div style={{ marginTop: 4 }}>
              <Checkbox.Group value={weekDays} onChange={v => setWeekDays(v as number[])}>
                <Space>
                  {WEEK_DAYS.map(d => <Checkbox key={d.value} value={d.value}>{d.label}</Checkbox>)}
                </Space>
              </Checkbox.Group>
            </div>
          </div>
        )}

        <div style={{ background: '#f5f5f5', padding: '8px 12px', borderRadius: 6 }}>
          <Text type="secondary">{preview()}</Text>
          <br />
          <Text code>{generate()}</Text>
        </div>
      </Space>
    </Modal>
  )
}
