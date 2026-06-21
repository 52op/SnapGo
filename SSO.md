# SSO 单点登录配置

SnapGo 支持对接 [GoAuth](https://github.com/it0731/GoAuth) SSO 服务，使用 RS256 JWT 进行认证。

## 配置

编辑 `config.toml`:

```toml
[security]
auth_mode = "sso"
# 以下为 SSO 独有配置
sso_issuer = "https://auth.example.com"
sso_cookie_name = "_goauth_token"
sso_public_key = """-----BEGIN PUBLIC KEY-----
MIIBIjANBgkqhkiG9w0BAQEFAAOCAQ8AMIIBCgKCAQEA...
-----END PUBLIC KEY-----"""
```

## 认证流程

1. 用户访问 SnapGo → 检测到无有效 token → 跳转至 `{sso_issuer}/login?redirect={snapgo_url}/login`
2. GoAuth 认证成功后回跳 `{snapgo_url}/login?token={jwt}`
3. 前端将 token 存入 `localStorage`，后续 API 请求携带 `Authorization: Bearer {token}`
4. 后端中间件验证 RS256 签名、issuer、角色（仅 admin），自动创建/同步本地用户

## 公钥获取

从 GoAuth 服务端获取 RSA 公钥，复制时注意将换行符替换为 `\n` 或使用三引号 `"""..."""`。
