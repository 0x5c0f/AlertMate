# 🔥 AlertMate

> 可视化 Alertmanager 管理控制台 — 编辑配置、监控告警、管理静默，可选 AI 助手。

[**English**](README.md) | **中文**

<p align="center">
  <img src="https://img.shields.io/badge/license-Apache%202.0-blue" alt="License" />
  <img src="https://img.shields.io/badge/node-%3E%3D18-green" alt="Node" />
  <img src="https://img.shields.io/badge/react-19-blue" alt="React" />
</p>

---

## 什么是 AlertMate？

AlertMate 是 [Prometheus Alertmanager](https://prometheus.io/docs/alerting/latest/alertmanager/) 的全功能 Web 控制台。它以可视化界面替代手动 YAML 编辑，并集成实时远程操作——告警查看、静默管理和集群状态监控。

最初由 Google AI Studio 生成为配置编辑器，现已演进为综合管理工具。

### 核心能力

| 功能 | 说明 |
|---------|------|
| **可视化配置编辑** | 管理接收器（Slack、企业微信、钉钉、邮件、Webhook、PagerDuty）、路由树、抑制规则，标签式 UI |
| **YAML 生成与校验** | 一键下载 `alertmanager.yml`，实时校验 |
| **远程运维** | 查看活跃告警、创建/编辑/过期静默、检查集群状态——全部通过 Alertmanager API 直连 |
| **拉取配置** | 从运行中的 Alertmanager 实例导入已有配置 |
| **AI 助手**（可选） | 自然语言生成配置，支持 Gemini 和 OpenAI 兼容 API |
| **认证** | 可选的 JWT 登录，保护远程操作和 AI 功能 |
| **国际化** | 英文 / 简体中文 |

### 技术栈

React 19 · Express 4 · TypeScript · Vite 6 · Tailwind CSS 4 · Lucide Icons

---

## 快速开始

**前置条件：** Node.js ≥ 18

```bash
# 克隆仓库
git clone https://github.com/0x5c0f/AlertMate.git
cd AlertMate

# 安装依赖
npm install

# 运行（默认：无认证、无 AI）
npm run dev
```

打开 **http://localhost:3000**

---

## 配置

所有设置通过环境变量（开发环境使用 `.env.local`）：

### 基础配置

```bash
# Alertmanager 目标地址（默认：http://localhost:9093）
ALERTMANAGER_URL="http://your-alertmanager:9093"
```

### 认证（可选）

```bash
# 设置后启用登录，保护远程操作和 AI 功能
ADMIN_PASSWORD="your-strong-password"
JWT_SECRET="at-least-16-random-chars"
```

### AI 助手（可选）

```bash
# 启用 AI 功能
AI_ENABLED="true"

# API 密钥（必填）
AI_API_KEY="your-gemini-key"

# 或使用 OpenAI 兼容：
# AI_PROVIDER="custom"
# AI_BASE_URL="https://api.openai.com/v1"
# AI_API_KEY="sk-..."
# AI_MODEL="gpt-4o"
```

> ⚠️ AI_ENABLED 需要同时设置 ADMIN_PASSWORD——防止未授权的 API 密钥盗用。

---

## 生产构建

```bash
npm run build
npm start
# 监听 http://localhost:3000
```

---

## 架构

```
┌─ 浏览器 ───────────────────────────────────────────┐
│  React SPA                                           │
│  ├─ 配置编辑器（接收器 / 路由 / 抑制规则）             │
│  ├─ 验证与部署（YAML 导出 + 拉取配置）                 │
│  ├─ 远程运维（告警 / 静默 / 状态）                     │
│  └─ AI 助手（可选）                                   │
│                       │                              │
│  直接调用 Alertmanager API（告警/静默/状态）           │
└───────────────────────┼──────────────────────────────┘
                        │
┌─ Node.js 服务 ────────┼──────────────────────────────┐
│  Express 4                                            │
│  ├─ /api/config        读取配置状态                    │
│  ├─ /api/validate      YAML 校验                      │
│  ├─ /api/parse-yaml    YAML → 内部格式转换             │
│  ├─ /api/auth/*        JWT 登录/状态                  │
│  └─ /api/ai/*          AI 助手（可选）                 │
│                                                       │
│  不代理 Alertmanager 请求（无 SSRF 风险）               │
└───────────────────────────────────────────────────────┘
```

---

## 安全

- **无 SSRF**：所有远程操作由浏览器直连 Alertmanager
- **认证可选**：配置 `ADMIN_PASSWORD` 保护远程操作和 AI
- **AI 保护**：`AI_ENABLED=true` 强制启用认证
- **JWT**：HS256，24h 过期，恒定时间密码比较
- **配置密钥**：认证启用时 API 响应自动脱敏
- **请求体限制**：1MB

> ⚠️ AlertMate 的登录**不会**保护 Alertmanager 本身。你的 Alertmanager 必须独立做访问控制（反向代理、网络策略或 `--web.config.file`）。

---

## 许可

Apache 2.0 — 详见 [LICENSE](LICENSE)
