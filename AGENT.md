# ycc

## 项目概述

**ycc** 是一个基于终端的 AI 聊天与代码智能体应用，使用 **Bun**、**React** 和 **Ink**（终端 UI 的 React）构建。它提供了一个交互式命令行界面，用户可以与 AI 模型（OpenAI 兼容）对话，并通过基于 **LangGraph** 的多智能体系统执行复杂的代码任务。

### 核心特性
- **AI 聊天界面**：直接在终端中流式接收 OpenAI 兼容 API 的响应
- **多智能体编排**：基于 LangGraph 的有限状态机编排，支持 Supervisor-Worker 架构
- **斜杠命令系统**：可扩展的命令注册机制（`/clear`、`/exit`、`/status`、`/init`、`/models`、`/agent`）
- **会话持久化**：自动将会话历史保存到 `~/.ycc/sessions/` 目录
- **状态管理**：使用 Zustand 管理会话、运行时和配置状态
- **组件化 UI**：基于 Ink 的 React 终端组件
- **三层工具漏斗模型**：按需分配，最小权限的工具访问控制

### 技术栈
- **运行时**：Bun (v1.3.11+)
- **UI 框架**：React 19 + Ink 6（终端 UI 组件）
- **AI 集成**：Vercel AI SDK (`ai`) + `@ai-sdk/openai` + LangChain/LangGraph
- **CLI 框架**：Commander.js
- **状态管理**：Zustand（带持久化中间件）
- **语言**：TypeScript (ESNext, strict mode)

## 项目结构

```
src/
├── index.tsx              # 入口文件 - 渲染 App（带 StoreProvider）
├── App.tsx                # 主应用组件（状态管理、AI 流式处理、智能体编排）
├── types.ts               # Message 类型定义
├── agent/                 # 多智能体系统
│   ├── orchestrator.ts    # 团队统筹器（执行图引擎）
│   ├── state.ts           # 图状态管理
│   ├── config/            # 智能体配置（团队定义、模型层级）
│   ├── prompts/           # 系统提示词
│   ├── teams/             # 团队配置
│   ├── tools/             # 智能体工具集
│   ├── types/             # 智能体类型定义
│   └── shared/            # 共享工具与上下文
├── commands/              # 斜杠命令实现
│   ├── index.ts           # 命令注册表
│   ├── clear/             # /clear 命令
│   ├── exit/              # /exit 命令
│   ├── status/            # /status 命令
│   ├── init/              # /init 命令
│   ├── models/            # /models 命令
│   └── agent/             # /agent 命令
├── components/            # React UI 组件
│   ├── ChatArea.tsx       # 显示聊天历史
│   ├── CommandInput.tsx   # 用户输入框
│   ├── Welcome.tsx        # 欢迎界面
│   └── StatusBar.tsx      # 状态栏
├── storage/               # Zustand 状态管理
│   ├── index.ts           # 统一导出
│   ├── sessionStore.ts    # 会话管理（历史与文件持久化）
│   ├── runtimeStore.ts    # 运行时状态（流式文本、生成状态、智能体状态）
│   ├── configStore.ts     # 配置管理（模型配置、团队配置，持久化到文件）
│   └── storage.ts         # 文件存储工具
├── types/                 # TypeScript 类型定义
│   └── command.ts         # Command 接口定义
├── setting/               # 设置相关
├── stu/                   # 构建相关
├── tools/                 # 工具函数
└── utils/                 # 工具函数（AI 模型创建等）
```

## 架构设计

### 智能体系统架构
系统采用基于 **LangGraph** 的有限状态机编排，核心设计理念：

1. **默认隔离，显式共享**：主图 (Supervisor) 与子图 (Worker) 的 State 物理隔离，子智能体产生的冗长过程数据只在本地生灭
2. **三层工具漏斗模型**：全局高危拦截 → 运行环境限制 → 智能体角色白名单
3. **状态更新与通知的原子性分离**：底层状态流转不被 UI 渲染阻塞
4. **基于角色的上下文裁剪**：向不同智能体路由时，仅传递必要的上下文

### 事件流处理
`App.tsx` 通过 `TeamOrchestrator.executeTask()` 消费异步事件流：
- `agent_start`：智能体切换，更新状态栏
- `tool_start` / `tool_end`：工具执行追踪
- `message_chunk`：流式更新 AI 响应
- `task_complete`：任务完成，固化最终结果

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

- **TypeScript**：启用严格模式，ESNext 目标，`noEmit: true`（由 Bun 负责运行）
- **JSX**：使用 `react-jsx` 转换
- **模块系统**：ESM
- **状态管理**：使用 Zustand 创建独立 store，通过 Provider 注入
  - `sessionStore`：管理聊天历史和会话持久化
  - `runtimeStore`：管理临时运行时状态（流式文本、生成标志、智能体状态）
  - `configStore`：管理用户配置，支持文件持久化
- **命令模式**：新斜杠命令应添加到 `src/commands/`，遵循 `src/types/command.ts` 中的 `Command` 接口
- **会话存储**：会话数据自动持久化到 `~/.ycc/sessions/` 目录，配置文件存储到 `~/.ycc/config.json`
- **智能体定义**：新智能体应添加到 `src/agent/config/teams/`，遵循声明式 `AgentDefinition` 接口

## 关键设计模式

### Message 类型
```typescript
interface Message {
    id: string;
    role: 'ai' | 'user' | 'system';
    content: string;
    isTrace?: boolean;  // 标记是否为 UI 追踪日志（不发送给模型）
}
```

### 智能体事件类型
```typescript
type AgentEvent =
  | { type: 'agent_start'; agentName: string; description: string }
  | { type: 'tool_start'; toolName: string; args: any }
  | { type: 'tool_end'; toolName: string; result: string }
  | { type: 'message_chunk'; content: string }
  | { type: 'task_complete'; finalResult: string }
  | { type: 'error'; message: string };
```

## 文档资源

项目文档位于 `docs/` 目录，包含：
- `agent.md`：智能体系统架构设计
- `storage_architecture.md`：存储架构
- `data_flow.md`：数据流设计
- `fat-tools-architecture.md`：胖工具架构
- `Graph-as-a-Team.md`：图作为团队的理念
- 以及其他设计与技术文档
