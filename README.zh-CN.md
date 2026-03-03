[English](README.md) | [中文](README.zh-CN.md)

# ai-safe-env

**保护 .env 密钥不被 AI 编码工具读取。** 零依赖的 Node.js 方案，替代 [enveil](https://github.com/GreatScott/enveil)。

Claude Code、Cursor、Copilot 等 AI 工具可以读取你的 `.env` 文件。`ai-safe-env` 确保明文密钥永远不会出现在磁盘上 —— 你的 `.env` 只包含符号引用，真实值存储在 AES-256-GCM 加密的本地存储中。

## 为什么不用 enveil？

enveil 很好，但需要 Rust/cargo。`ai-safe-env` 只需一次 **`npm install`**，零依赖（使用 Node.js 内置的 `crypto`）。可直接替代 `dotenv`。

## 快速开始

```bash
npm install -g ai-safe-env

# 在你的项目中：
ai-safe-env init
ai-safe-env set database_url "postgres://user:pass@localhost/db"
ai-safe-env set stripe_key "sk_live_..."
```

编辑你的 `.env`：
```
DATABASE_URL=ase://database_url
STRIPE_KEY=ase://stripe_key
PORT=3000
```

在应用中使用（替代 `require('dotenv').config()`）：
```js
require('ai-safe-env').config({ password: process.env.ASE_PASSWORD });
// process.env.DATABASE_URL 现在是真实值了
```

或直接运行命令：
```bash
ai-safe-env run -- node server.js
```

## 迁移已有 .env

```bash
ai-safe-env migrate
# 加密所有值，用 ase:// 引用重写 .env
# 原文件备份为 .env.backup
```

## 工作原理

1. 密钥存储在 `~/.ai-safe-env/<project-hash>.enc`（AES-256-GCM，scrypt 密钥派生）
2. `.env` 文件只包含 `ase://key_name` 引用 —— AI 工具读取到的是安全的
3. 运行时，引用从加密存储中解析并注入 `process.env`

## 安全性

- AES-256-GCM 加密，scrypt 密钥派生（N=16384, r=8, p=1）
- 每次写入使用全新随机 salt（16 字节）和 IV（12 字节）
- 认证标签防篡改
- 无密码情况下，存储文件与随机数据无法区分

## 许可证

MIT
