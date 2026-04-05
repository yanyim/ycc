# ycc

## 项目概述

**ycc** 是一个基于终端的 AI 聊天应用，使用 **Bun**、**React** 和 **Ink**（终端 UI 的 React）构建。它提供了一个交互式命令行界面，用户可以与 AI 模型（OpenAI 兼容）对话并执行内置的斜杠命令。

### 核心特性
- **AI 聊天界面**：直接在终端中流式接收 OpenAI 兼容 API 的响应
- **斜杠命令系统**：可扩展的命令注册机制（`/clear`、`/exit`、`/status`、`/init`）
- **会话持久化**：自动将会话历史保存到 `~/.ycc/sessions/` 目录
- **状态管理**：使用 Zustand 管理会话、运行时和配置状态
- **组件化 UI**：基于 Ink 的 React 终端组件

### 技术栈
- **运行时**：Bun (v1.3.11+)
- **UI 框架**：React 19 + Ink 6（终端 UI 组件）
- **AI 集成**：Vercel AI SDK (`ai`) + `@ai-sdk/openai`
- **CLI 框架**：Commander.js
- **状态管理**：Zustand（带持久化中间件）
- **语言**：TypeScript (ESNext, strict mode)

## 项目结构

```
src/
├── index.tsx              # 入口文件 - 渲染 App（带 StoreProvider）
├── App.tsx                # 主应用组件（状态管理、AI 流式处理）
├── types.ts               # Message 类型定义
├── commands/              # 斜杠命令实现
│   ├── index.ts           # 命令注册表
│   ├── clear/             # /clear 命令
│   ├── exit/              # /exit 命令
│   ├── status/            # /status 命令
│   └── init/              # /init 命令
├── components/            # React UI 组件
│   ├── ChatArea.tsx       # 显示聊天历史
│   ├── CommandInput.tsx   # 用户输入框
│   └── Welcome.tsx        # 欢迎界面
├── storage/               # Zustand 状态管理
│   ├── index.ts           # 统一导出
│   ├── sessionStore.ts    # 会话管理（历史与文件持久化）
│   ├── runtimeStore.ts    # 运行时状态（流式文本、生成状态）
│   ├── configStore.ts     # 配置管理（模型配置，持久化到文件）
│   ├── Provider.tsx       # React Context Provider
│   └── storage.ts         # 文件存储工具
├── types/                 # TypeScript 类型定义
│   └── command.ts         # Command 接口定义
├── setting/               # 设置相关
└── utils/                 # 工具函数
```

## 构建与运行

### 前置要求
- Bun v1.3.11 或更高版本
- 环境变量：
  - `AI_API_KEY`：OpenAI 兼容 API 密钥
  - `AI_BASE_URL`：API 基础 URL

### 常用命令

```bash
# 安装依赖
bun install

# 运行应用
bun run src/index.tsx

# 构建（输出到 ./out）
bun run build
```

## 开发规范

- **TypeScript**：启用严格模式，ESNext 目标
- **JSX**：使用 `react-jsx` 转换
- **模块系统**：ESM
- **状态管理**：使用 Zustand 创建独立 store，通过 Provider 注入
- **命令模式**：新斜杠命令应添加到 `src/commands/`，遵循 `src/types/command.ts` 中的 `Command` 接口
- **会话存储**：会话数据自动持久化到 `~/.ycc/sessions/` 目录，配置文件存储到 `~/.ycc/config.json`

## 架构说明

- 应用使用 **Ink** 在终端中渲染 React 组件
- AI 流式响应通过 Vercel AI SDK 的 `streamText` 函数处理
- 会话历史在 React 状态中维护，支持多轮对话上下文
- 命令通过 Map 注册系统注册，支持别名
- 状态管理分为三个独立 store：
  - `sessionStore`：管理聊天历史和会话持久化
  - `runtimeStore`：管理临时运行时状态（流式文本、生成标志）
  - `configStore`：管理用户配置，支持文件持久化
