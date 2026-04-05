# Code CLI 智能体系统架构设计文档 (Code-as-Action)

## 一、 核心架构理念
本系统摈弃传统的“全能单体大模型+全量工具”模式，采用基于 **LangGraph** 的有限状态机（State Machine）编排。核心设计向 Claude Code 靠拢，主打**高并发、严格隔离与极致的上下文管控**。



## 二、 四大核心方法论 (Methodologies)

1. **默认隔离，显式共享 (Default Isolation, Explicit Sharing)**
    * **原则：** 坚决抵制将全局 `Messages` 直接喂给所有子智能体。
    * **落地：** 主图 (Supervisor) 与子图 (Worker) 的 State 必须物理隔离。子智能体在自己的 SubGraph 中循环产生的大量无效过程数据（如 grep 结果）只在本地生灭。子任务结束时，仅通过显式回调 (`commitResult`) 将精炼的结论提交给全局 State。
2. **三层工具漏斗模型 (Tiered Tool Funnel)**
    * **原则：** 按需分配，最小权限。
    * **落地：** 动态构建节点的可用工具集。必须经过三层拦截：全局高危拦截（如只读模式） $\rightarrow$ 运行环境限制（后台静默 Agent 禁用需用户交互的工具） $\rightarrow$ 智能体角色白名单（`allowedTools`）。
3. **状态更新与通知的原子性分离 (State First, Notification Second)**
    * **原则：** 底层状态流转绝对不能被 UI 渲染阻塞。
    * **落地：** 在 Tool 执行或 Node 切换时，必须先构造并返回 LangGraph 的 State 增量，然后再通过异步 Generator 向 TUI 界面抛出渲染事件（`AgentEvent`）。
4. **基于角色的上下文裁剪 (Role-Based Context Trimming)**
    * **原则：** 砍掉非必要 Token，提升模型精度的同时降低成本。
    * **落地：** 定义重量级上下文（`heavyContext`）。例如，向 Explore Agent 路由时，仅传递指令，拦截完整代码结构；而向 Coder Agent 路由时，再全量注入。

---

## 三、 系统分层接口设计规范

### 1. 声明式智能体定义层 (Declarative Definitions)
将 Agent 抽象为纯配置，与执行逻辑解耦。

```typescript
export type AgentRole = 'supervisor' | 'explorer' | 'coder' | 'verifier';
export type ModelTier = 'fast' | 'reasoning' | 'inherit';
export type IsolationMode = 'read-only' | 'tmp-only' | 'workspace-rw';

export interface AgentDefinition {
  name: string;
  role: AgentRole;
  description: string;           
  modelTier: ModelTier;
  isolation: IsolationMode;
  systemPrompt: string;
  criticalReminder?: string;     // 每轮 User Turn 重复注入的硬约束
  allowedTools?: string[] | '*'; // 工具漏斗配置
  disallowedTools?: string[];
  omitHeavyContext?: boolean;    // Token 优化开关
}
```

### 2. 状态隔离层 (Graph State Management)
利用 LangGraph 的 Channel 机制进行状态切分。

```typescript
import { BaseMessage } from "@langchain/core/messages";

// 1. 全局状态 (Supervisor 维护)
export interface GlobalGraphState {
  messages: BaseMessage[];       // 用户与系统的精简对话
  workspaceCwd: string;
  heavyContext: string;          // 代码片段、Git Diff 等大体积上下文
  nextWorker: AgentRole | 'FINISH'; 
}

// 2. 子任务隔离状态 (Worker Graph 维护)
export interface SubAgentContext {
  taskId: string;
  localMessages: BaseMessage[];  // 子任务内部循环产生的冗长日志
  commitResult: (summary: string, extractedContext?: string) => void;
}
```

### 3. 事件抛出与 UI 边界 (Orchestrator & TUI Integration)
封装 LangGraph 底层，向上层 React Ink 提供标准化的异步事件流。

```typescript
// 渲染层可消费的原子事件
export type AgentEvent = 
  | { type: 'agent_start'; agentName: string; description: string }
  | { type: 'tool_start'; toolName: string; args: any }
  | { type: 'tool_end'; toolName: string; result: string }
  | { type: 'message_chunk'; content: string }
  | { type: 'human_intervention_required'; prompt: string; resumePayload: any }
  | { type: 'task_complete'; finalResult: string }
  | { type: 'error'; message: string };

export interface ICodeAgentOrchestrator {
  // 主入口，替代原有的 streamText
  executeTask(userPrompt: string, globalState: GlobalGraphState): AsyncGenerator<AgentEvent, void, unknown>;
  
  // 从人类干预 (如 Y/n 确认) 中恢复图的执行
  resumeTask(threadId: string, payload: any): AsyncGenerator<AgentEvent, void, unknown>;
}
```

---

## 四、 React Ink UI 接入路线图

在后续的实现中，前端 `App.tsx` 的改动路径如下：

1. **废弃直连：** 移除直接调用的 `streamText`。
2. **事件解析引擎：** 在 `handleInputSubmit` 中实例化 `CodeAgentOrchestrator`。
3. **状态映射：** 通过 `for await (const event of orchestrator.executeTask(text, state))` 消费事件流。
    * 遇到 `message_chunk`：继续高频更新 `useRuntimeStore` 的 `currentStream`。
    * 遇到 `tool_start`：在 UI 渲染 `<Spinner />` 和工具描述。
    * 遇到 `human_intervention_required`：渲染一个命令行选择器供用户确认，暂停等待输入。
4. **持久化落盘：** 只有遇到 `task_complete`，才将最终的核心结果推入 `useSessionStore` 的 `addMessage` 中，实现本地文件落盘。