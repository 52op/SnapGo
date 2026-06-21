# SnapGo

服务器备份管理工具。纯 Go 单二进制部署（嵌入 React 前端），支持 SQLite/文件备份到 S3/FTP/WebDAV/SFTP。跨平台：Windows / Linux / macOS。

## 功能

- **多数据源支持**：SQLite 数据库（VACUUM INTO 在线快照）、单文件、目录/通配符
- **多目标支持**：S3 兼容对象存储、FTP、WebDAV、SFTP、本地目录
- **压缩加密**：gzip 压缩 + age 加密
- **保留策略**：按天自动清理过期备份
- **定时调度**：Cron 表达式 + 可视化 Cron 助手
- **双认证模式**：独立登录（JWT）或 GoAuth SSO 单点登录
- **Web 配置界面**：Ant Design 前端，所有操作在页面完成

## 快速开始

```bash
# 下载对应系统的二进制
./SnapGo

# 打开浏览器访问
# http://localhost:8081

# 默认管理员
# 用户名: admin@snapgo.local
# 密码: snapgo
```

## 配置文件

首次运行会自动创建 `config.toml`（不存在时）:

```toml
[server]
address = ":8081"

[database]
path = "./snapgo.db"

[security]
auth_mode = "standalone"              # standalone 或 sso
jwt_secret = "change-this-jwt-secret"

[admin]
default_username = "admin@snapgo.local"
default_password = "snapgo"
```

SSO 模式配置详见 [SSO.md](SSO.md)。

## 构建

```bash
# Windows
build.bat

# Linux / macOS
chmod +x build.sh && ./build.sh
```
