import { Card, Typography, Steps, Tag, Alert, Divider, Space } from 'antd'
import {
  DatabaseOutlined,
  CloudServerOutlined,
  CloudUploadOutlined,
  ScheduleOutlined,
  CheckCircleOutlined,
  ArrowRightOutlined,
  BulbOutlined,
  FolderOutlined,
  FileOutlined,
} from '@ant-design/icons'

const { Title, Paragraph, Text } = Typography

const FlowStep = ({ icon, title, desc, color }: { icon: React.ReactNode; title: string; desc: string; color: string }) => (
  <Card size="small" style={{ textAlign: 'center', minWidth: 140, borderColor: color }}>
    <div style={{ fontSize: 28, color, marginBottom: 4 }}>{icon}</div>
    <Text strong>{title}</Text>
    <br />
    <Text type="secondary" style={{ fontSize: 12 }}>{desc}</Text>
  </Card>
)

const Arrow = () => (
  <div style={{ display: 'flex', alignItems: 'center', fontSize: 20, color: '#999', padding: '0 4px' }}>
    <ArrowRightOutlined />
  </div>
)

export default function Help() {
  return (
    <Typography style={{ maxWidth: 900, margin: '0 auto' }}>
      <Title level={2}>使用说明</Title>

      {/* 核心流程 */}
      <Card title="备份流程总览" style={{ marginBottom: 24 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', flexWrap: 'wrap', gap: 8, marginBottom: 16 }}>
          <FlowStep icon={<DatabaseOutlined />} title="备份源" desc="指定要备份的文件或数据库" color="#1890ff" />
          <Arrow />
          <FlowStep icon={<CloudServerOutlined />} title="存储提供商" desc="配置远程存储连接信息" color="#722ed1" />
          <Arrow />
          <FlowStep icon={<CloudUploadOutlined />} title="备份目标" desc="将提供商 + 路径组合为目标" color="#13c2c2" />
          <Arrow />
          <FlowStep icon={<ScheduleOutlined />} title="备份任务" desc="绑定源→目标，设置定时" color="#fa8c16" />
          <Arrow />
          <FlowStep icon={<CheckCircleOutlined />} title="执行备份" desc="自动/手动触发，上传并清理" color="#52c41a" />
        </div>
        <Alert type="info" showIcon message="简单理解：备份源告诉系统"备份什么"，存储提供商告诉系统"存到哪"，备份目标告诉系统"存在哪个目录"，备份任务把它们串起来并设定执行时间。" />
      </Card>

      {/* 快速开始 */}
      <Card title="快速开始（5 步完成配置）" style={{ marginBottom: 24 }}>
        <Steps
          direction="vertical"
          current={-1}
          items={[
            {
              title: '第一步：添加存储提供商',
              description: (
                <Card size="small" style={{ marginTop: 8, background: '#f6ffed' }}>
                  <Paragraph>进入 <Tag>存储提供商</Tag> 页面，点击「新增」，填写：</Paragraph>
                  <ul>
                    <li><Text strong>名称</Text>：随便起，如 "我的阿里云 OSS"</li>
                    <li><Text strong>类型</Text>：选 S3 / WebDAV / FTP / SFTP</li>
                    <li><Text strong>连接参数</Text>：Endpoint、Access Key 等（参考各云服务商文档）</li>
                  </ul>
                  <Paragraph type="secondary" style={{ margin: 0 }}>💡 点击「测试连接」可验证参数是否正确</Paragraph>
                </Card>
              ),
              icon: <CloudServerOutlined style={{ color: '#722ed1' }} />,
            },
            {
              title: '第二步：添加备份源',
              description: (
                <Card size="small" style={{ marginTop: 8, background: '#e6f7ff' }}>
                  <Paragraph>进入 <Tag>备份源</Tag> 页面，点击「新增」：</Paragraph>
                  <ul>
                    <li><Text strong>名称</Text>：如 "GoAuth 数据库"</li>
                    <li><Text strong>路径列表</Text>：输入路径后回车添加，支持多个
                      <br /><Text type="secondary">• 文件/目录：点击左侧按钮切换「文件」或「目录」</Text>
                      <br /><Text type="secondary">• SQLite 数据库：切换为「数据库」，系统会自动 VACUUM INTO 快照</Text>
                      <br /><Text type="secondary">• 通配符：支持 <code>*</code> 匹配，如 <code>/var/log/*.log</code></Text>
                    </li>
                    <li><Text strong>打包方式</Text>：多路径时选「打包成一个 tar.gz」或「每个路径单独备份」</li>
                    <li><Text strong>压缩</Text>：开启后自动 gzip 压缩（目录路径始终压缩）</li>
                  </ul>
                </Card>
              ),
              icon: <DatabaseOutlined style={{ color: '#1890ff' }} />,
            },
            {
              title: '第三步：添加备份目标',
              description: (
                <Card size="small" style={{ marginTop: 8, background: '#fff7e6' }}>
                  <Paragraph>进入 <Tag>备份目标</Tag> 页面，点击「新增」：</Paragraph>
                  <ul>
                    <li><Text strong>名称</Text>：如 "阿里云 OSS 备份"</li>
                    <li><Text strong>配置方式</Text>：选择「引用已有提供商」，然后选刚才创建的提供商</li>
                    <li><Text strong>路径前缀</Text>：备份文件存放的目录，留空自动用目标名称</li>
                    <li><Text strong>保留天数</Text>：超过天数的旧备份自动清理（0 = 不清理）</li>
                    <li><Text strong>始终唯一</Text>：开启后每次上传前清空该路径下的所有旧文件</li>
                  </ul>
                </Card>
              ),
              icon: <CloudUploadOutlined style={{ color: '#13c2c2' }} />,
            },
            {
              title: '第四步：创建备份任务',
              description: (
                <Card size="small" style={{ marginTop: 8, background: '#f9f0ff' }}>
                  <Paragraph>进入 <Tag>备份任务</Tag> 页面，点击「新增」：</Paragraph>
                  <ul>
                    <li><Text strong>名称</Text>：如 "每日备份 GoAuth"</li>
                    <li><Text strong>备份源</Text>：选第二步创建的源</li>
                    <li><Text strong>备份目标</Text>：选第三步创建的目标</li>
                    <li><Text strong>Cron 表达式</Text>：设定执行时间，可用「Cron 辅助工具」生成
                      <br /><Text type="secondary">• 每天凌晨2点：<code>0 2 * * *</code></Text>
                      <br /><Text type="secondary">• 每周六凌晨3点：<code>0 3 * * 6</code></Text>
                      <br /><Text type="secondary">• 每小时：<code>0 * * * *</code></Text>
                    </li>
                  </ul>
                </Card>
              ),
              icon: <ScheduleOutlined style={{ color: '#fa8c16' }} />,
            },
            {
              title: '第五步：执行并验证',
              description: (
                <Card size="small" style={{ marginTop: 8, background: '#f6ffed' }}>
                  <ul>
                    <li>在 <Tag>备份任务</Tag> 列表点击「立即执行」手动触发一次</li>
                    <li>切换到 <Tag>执行日志</Tag> 查看执行结果</li>
                    <li>状态显示「成功」= 备份完成，可去存储提供商确认文件已上传</li>
                    <li>后续系统会按 Cron 表达式自动执行</li>
                  </ul>
                </Card>
              ),
              icon: <CheckCircleOutlined style={{ color: '#52c41a' }} />,
            },
          ]}
        />
      </Card>

      {/* 目录结构 */}
      <Card title="备份文件在存储中的目录结构" style={{ marginBottom: 24 }}>
        <pre style={{ background: '#f5f5f5', padding: 16, borderRadius: 8, fontSize: 13, margin: 0 }}>
{`存储提供商根目录/
├── 备份目标名称/           ← 路径前缀（留空则用目标名称）
│   ├── 备份源名称_20260621_143022.tar.gz   ← 带时间戳的备份文件
│   ├── 备份源名称_20260620_143022.tar.gz   ← 昨天的备份
│   └── ...                                  ← 保留天数内的历史版本`}
        </pre>
        <Alert type="success" showIcon message="保留天数到期的旧文件会自动清理；开启「始终唯一」则每次备份前清空目录。" style={{ marginTop: 12 }} />
      </Card>

      {/* 常见问题 */}
      <Card title="常见问题" style={{ marginBottom: 24 }}>
        <Card type="inner" title="Q: 数据库备份和文件备份有什么区别？" size="small" style={{ marginBottom: 12 }}>
          <Space direction="vertical" size={4}>
            <Text><Tag color="blue">文件</Tag> 直接复制原文件，适合配置文件、日志等</Text>
            <Text><Tag color="green">数据库</Tag> 使用 SQLite 的 VACUUM INTO 命令生成一致性快照，即使数据库正在被读写也能安全备份</Text>
            <Text><Tag color="orange">目录</Tag> 自动打包成 tar.gz，不受压缩开关控制</Text>
          </Space>
        </Card>
        <Card type="inner" title="Q: S3 和 WebDAV 怎么选？" size="small" style={{ marginBottom: 12 }}>
          <Text>阿里云 OSS / AWS S3 / MinIO 等选 <Tag>S3</Tag>；坚果云、NextCloud 等选 <Tag>WebDAV</Tag>；路由器 NAS 选 <Tag>FTP</Tag> 或 <Tag>SFTP</Tag>。</Text>
        </Card>
        <Card type="inner" title="Q: Cron 表达式怎么写？" size="small" style={{ marginBottom: 12 }}>
          <Text>点击任务编辑弹窗中的「Cron 辅助工具」按钮，通过可视化选择自动生成。也可以参考在线 Cron 生成器。</Text>
        </Card>
        <Card type="inner" title="Q: 手动执行和定时执行有区别吗？" size="small" style={{ marginBottom: 12 }}>
          <Text>没有区别，执行逻辑完全一样。手动执行适合首次测试或紧急备份。</Text>
        </Card>
        <Card type="inner" title="Q: 备份失败了怎么排查？" size="small" style={{ marginBottom: 12 }}>
          <Text>进入 <Tag>执行日志</Tag> 查看错误信息。常见原因：存储连接参数错误、磁盘空间不足、路径不存在。</Text>
        </Card>
        <Card type="inner" title="Q: 如何只保留最新一份备份？" size="small">
          <Text>在备份目标中开启「始终唯一」，系统会在每次上传前删除该路径下的所有旧文件。</Text>
        </Card>
      </Card>

      {/* 各存储类型参数速查 */}
      <Card title="存储提供商参数速查" style={{ marginBottom: 24 }}>
        <Card type="inner" title="S3（阿里云 OSS / AWS S3 / MinIO）" size="small" style={{ marginBottom: 12 }}>
          <ul style={{ margin: 0, paddingLeft: 20 }}>
            <li><Text strong>Endpoint</Text>：如 <code>oss-cn-hangzhou.aliyuncs.com</code>（不带 https://）</li>
            <li><Text strong>Bucket</Text>：如 <code>my-backup-bucket</code></li>
            <li><Text strong>Access Key / Secret Key</Text>：云服务商控制台获取</li>
            <li><Text strong>Region</Text>：如 <code>cn-hangzhou</code>（可选）</li>
          </ul>
        </Card>
        <Card type="inner" title="WebDAV（坚果云 / NextCloud）" size="small" style={{ marginBottom: 12 }}>
          <ul style={{ margin: 0, paddingLeft: 20 }}>
            <li><Text strong>Endpoint</Text>：如 <code>https://dav.jianguoyun.com/dav/</code></li>
            <li><Text strong>用户名 / 密码</Text>：在服务商处生成的应用专用密码</li>
          </ul>
        </Card>
        <Card type="inner" title="FTP / SFTP" size="small">
          <ul style={{ margin: 0, paddingLeft: 20 }}>
            <li><Text strong>Host</Text>：如 <code>192.168.1.100</code></li>
            <li><Text strong>Port</Text>：FTP 默认 21，SFTP 默认 22</li>
            <li><Text strong>用户名 / 密码</Text>：服务器登录凭证</li>
          </ul>
        </Card>
      </Card>
    </Typography>
  )
}
