
# 📖 Code CLI 系统提示词工程 (System Prompt Engineering) 架构设计

## 一、 核心设计理念 (Core Philosophy)

在传统的单体 AI 应用中，System Prompt 通常只是一段硬编码的静态字符串。但在构建工业级的多智能体（Multi-Agent）系统时，System Prompt 必须被视为一个**具备生命周期、缓存策略和条件编译机制的“微服务系统”**。

本系统的 Prompt 架构升级遵循以下三大核心理念：

1. **极致的 Prompt Cache 优化 (动静分离)**：利用大模型 API 的前缀匹配缓存机制（Prefix Caching），最大化共享 Token，大幅降低高频协作流中的 API 成本。
2. **组件化与条件挂载 (Componentization)**：将长篇大论的提示词拆分为独立的模块（如：安全指引、工具优先级、代码风格）。根据 Agent 角色和环境状态按需组装。
3. **基于角色的行为硬约束 (Role-Based Hard Constraints)**：利用提示词位置权重（如末尾注入 `criticalReminder`）和专属规则，克服大模型的“幻觉”和“过度工程”本能。

## 二、 现有架构的局限性与痛点

目前我们在 `src/agent/config/agents.ts` 中的配置，使用的是单块字符串拼接模式（Monolithic String）：

* **痛点 1：缓存破坏 (Cache Busting)**：如果将动态变量（如当前目录 `process.cwd()`、当前时间）直接拼在提示词开头，会导致每次请求的前缀都发生改变，API 缓存命中率降为 0。
* **痛点 2：规则冗余与维护困难**：四个 Agent (Supervisor, Explorer, Coder, Verifier) 共享许多底层规则（如不要随意猜测 URL、优先使用特定工具），当前只能复制粘贴，缺乏统一的模块化管理。
* **痛点 3：工具滥用与幻觉**：缺乏系统级的指引，模型容易绕过安全文件工具去盲目调用 `bash`，或者在测试环节产生“虚报成功”的幻觉。

## 三、 架构升级方案：动静分离与组件流水线

我们将引入一个统一的 `PromptBuilder`，将提示词的组装流水线化，并引入一个绝对的分界线：`=== DYNAMIC CONTEXT BOUNDARY ===`。

### 1. 静态段 (Static Sections) —— 全局缓存命中区
分界线之前的内容，必须在整个 CLI 会话生命周期内保持**绝对一致**。
* **身份定义 (Identity)**：Agent 是谁（如 `You are a strict Code Verifier.`）。
* **基础系统约束 (System Constraints)**：禁止 Prompt 注入、只能输出指定语言等。
* **工具使用优先级 (Tool Prioritization)**：显式路由工具。例如：“读取文件必须用 `read_file`，绝对禁止用 `cat`；查找内容必须用 `grep_search`，禁止用 `grep`”。
* **行为与代码风格 (Code Style & Behavior)**：反过度工程指令（“不要过度抽象”、“只需修复 Bug，不要重构周围代码”）。

### 2. 动态段 (Dynamic Sections) —— 缓存隔离区
分界线之后的内容，是每次提问或每个任务都在变化的，**不参与**前缀缓存。
* **工作区环境 (Workspace Env)**：当前路径、系统时间。
* **项目上下文 (Project Context)**：Git 状态、从 `.gitignore` 或项目架构文档中提取的动态内容。

## 四、 四大 Agent 专属 Prompt 策略与参数映射

在新的 `AgentDefinition` 中，我们将废弃 `systemPrompt` 字符串，改为基于布尔开关的特性挂载：

### 1. Supervisor (大老板)
* **定位**：任务拆解与分发路由。
* **Prompt 挂载重点**：
    * `injectWorkspaceContext: true` (需要了解全局环境)。
    * **核心指令**：明确路由规则，强调避免重复验证，并在任务结束时果断输出 `"FINISH"`。

### 2. Explorer (探路者)
* **定位**：只读模式下的高并发信息提取专家。
* **Prompt 挂载重点**：
    * `enableAntiHallucinationRules: true` (防止编造代码)。
    * **核心指令**：极致简短。强调“不写代码，只找代码”。要求它在使用 `read_file` 或 `grep_search` 时，必须提炼结论（如函数签名），禁止原样复述大段代码以节省 Token。

### 3. Coder (程序员)
* **定位**：具备读写权限的高级软件工程师。
* **Prompt 挂载重点**：
    * `enableCodeStyleRules: true` (挂载反过度工程指令)。
    * **核心指令**：严格执行“修改前必读”原则（READ BEFORE WRITE）。强制要求使用 `edit_file` 时必须基于精确的行号。写入新内容时必须保持原始缩进。

### 4. Verifier (对抗性测试员)
* **定位**：运行沙箱测试、检查报错的无情审查员。
* **Prompt 挂载重点**：
    * `enableAntiHallucinationRules: true`。
    * **核心指令**（缓解虚报幻觉 False-claims mitigation）：**“忠实报告结果。如果没有运行测试，必须明确说明，绝对不允许通过想象暗示代码运行成功。只有看到终端输出，才能确认通过。”** 必须配合末尾注入的 `criticalReminder` 克服遗忘曲线。

## 五、 代码落地步骤指导 (Implementation Roadmap)

1. **重构配置接口**：修改 `src/agent/types/events.ts`，更新 `AgentDefinition`，将 `systemPrompt` 替换为模块化开关选项。
2. **构建 PromptBuilder**：在 `src/agent/prompts/` 目录下创建 `builder.ts`。实现按数组拼装逻辑，并注入 `DYNAMIC_BOUNDARY`。
3. **编写 Sections 库**：在 `src/agent/prompts/sections/` 下分别建立 `tools.ts`、`rules.ts` 和 `dynamic.ts`，将长文本封装为函数。
4. **改造 WorkerGraph**：在 `src/agent/graphs/workerGraph.ts` 的 `agentNode` 中，将直接推送的 `SystemMessage` 改为调用 `buildSystemPrompt()` 生成结果。将 `criticalReminder` 和沉重的上下文作为单独的 `HumanMessage` 注入到会话的最新一轮中，保障缓存不被破坏。

---

