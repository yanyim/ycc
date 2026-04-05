# 📚 File System Tools (AI Agent) 架构与开发文档

## 1. 核心设计哲学 (Design Philosophy)

本套文件系统工具专为 AI Agent（特别是基于 LangGraph 的多智能体系统）设计，遵循以下三大“第一性原则”：

1.  **绝对的沙箱安全 (Sandbox Isolation)**：
    * 大模型（LLM）不能也不该感知宿主机的绝对路径。
    * 所有 Tool 均采用**高阶工厂函数模式**（如 `createReadFileTool(PROJECT_ROOT)`），通过**闭包**隐式绑定项目根目录。
    * 底层统一通过 `validateAndResolvePath` 拦截任何 `../` 形式的目录穿越（Directory Traversal）攻击。
2.  **极致的 Token 抠门与防幻觉 (Token Parsimony & Anti-Hallucination)**：
    * **分页与截断**：长文件禁止全量读取，强制要求 `offset` 和 `limit`；搜索结果强制设定上限（如 30 条熔断），防止撑爆 Context Window。
    * **行号注入**：读取代码时自动注入行号（`1 | const a = 1;`），为后续的精确定位和代码修改（Edit/Replace）提供唯一坐标系。
    * **明确的边界信号**：在文本末尾追加 `EOF` 或 `NOTE: File continues below`，防止模型产生“文件已读完”的幻觉。
3.  **权限分层与多智能体友好 (Role-Based Access Control)**：
    * 工具被拆分为完全独立的细粒度模块。便于为不同的 Agent（如 Researcher、Coder、Verifier）按需组装“只读套餐”或“读写套餐”。

---

## 2. 核心模块与功能清单

文件路径：`src/tools/file-system/`

### 2.0 底层基建：`utils.ts`
* **功能**：路径校验与解析。
* **核心逻辑**：无论 LLM 传入绝对路径还是相对路径，强制将其解析为基于 `projectRoot` 的路径，并判断 `relative` 结果是否跳出根目录。越权直接抛出 `Error("Access denied")`。

### 2.1 目录探测工具：`list_files` (`createListFiles.ts`)
* **定位**：Agent 的“项目地图”，用于探索目录结构。
* **核心机制**：
    * 底层使用 `fast-glob`。
    * 强制读取并应用项目根目录的 `.gitignore`。
    * 系统级保底屏蔽 `node_modules/**` 和 `.git/**`。
* **Schema (LLM 视角参数)**：
    * `directory` (string, optional): 相对目录，默认 `"."`。
    * `pattern` (string, optional): Glob 匹配规则，默认 `"**/*"`。
* **LLM 调用示例**：
    ```json
    { "directory": "src/components", "pattern": "**/*.tsx" }
    ```

### 2.2 探索性阅读工具：`read_file` (`createReadFile.ts`)
* **定位**：Agent 的“阅读器”，支持大文件分页。
* **核心机制**：
    * 底层使用 `Bun.file().text()` 实现极速读取。
    * 自动为返回的代码片段加上行号。
    * 支持 `offset`（起始行，1-based）和 `limit`（读取行数）精准截取。
* **Schema (LLM 视角参数)**：
    * `filePath` (string, required): 目标文件相对路径。
    * `offset` (number, optional): 起始行号，默认 1。
    * `limit` (number, optional): 读取行数，默认 100。
* **LLM 调用示例**：
    ```json
    { "filePath": "src/utils/ai.ts", "offset": 10, "limit": 20 }
    ```

### 2.3 极客搜索工具：`grep_search` (`createGrepSearch.ts`)
* **定位**：Agent 的“扫描仪”，用于精准定位代码上下文。
* **核心机制**：
    * 基于正则表达式在文本文件中跨文件搜索。
    * **安全越界处理**：返回命中行的同时附带上下各 1 行的上下文，自动处理首行/末行数组越界问题（`Math.max`/`Math.min`）。
    * **熔断保护 (Circuit Breaker)**：全局命中超过 30 次立即熔断终止搜索，并在结果末尾追加 `... and X more matches` 提示模型缩小搜索范围。
* **Schema (LLM 视角参数)**：
    * `query` (string, required): 搜索关键字或正则（忽略大小写）。
    * `directory` (string, optional): 指定搜索的相对目录。
    * `includePattern` (string, optional): 限制文件类型。
* **LLM 调用示例**：
    ```json
    { "query": "export function calculate", "directory": "src", "includePattern": "**/*.ts" }
    ```

### 2.4 进阶文件分析：`analyze_file` (`createAnalyzeFile.ts`)
* **定位**：Agent 的“结构分析师”，根据文件后缀采用不同的解析策略。
* **核心机制**：
    * 使用策略模式分发。
    * 当前实现：对于 `.json` 文件，不返回全文，仅解析并返回其 `Root Keys` 骨架。
    * 对于 `.ts`/`.tsx` 等代码文件，预留了 Tree-sitter AST 解析接口，当前 fallback 为读取前 50 行。
* **Schema (LLM 视角参数)**：
    * `filePath` (string, required): 目标文件相对路径。

---

## 3. 架构组合与使用范例 (index.ts)

工具采用**套餐化配置**，方便直接注入 LangGraph 或其他 Agent 框架：

```typescript
// src/tools/file-system/index.ts
import { createListFilesTool, createReadFileTool, createGrepSearchTool, createAnalyzeFileTool } from './...';

const PROJECT_ROOT = process.cwd();

// 基础套餐：给探索型 Agent 使用 (安全、无副作用)
export const readOnlyTools = [
    createListFilesTool(PROJECT_ROOT),
    createReadFileTool(PROJECT_ROOT),
    createGrepSearchTool(PROJECT_ROOT),
    createAnalyzeFileTool(PROJECT_ROOT)
];

// 特权套餐：未来给 Coder Agent 使用
export const editorTools = [
    ...readOnlyTools,
    // createWriteFileTool(PROJECT_ROOT), 待实现
    // createEditFileTool(PROJECT_ROOT)  待实现
];
```

---

## 4. 后续开发规划 (Roadmap)

在下一次会话或后续迭代中，将优先推进以下功能：

1.  **文件修改能力 (Write / Edit Tools)**:
    * 实现 `write_file`：覆盖或创建新文件，需自动递归创建缺失的父目录。
    * 实现 `edit_file`：基于 Udiff 或精准的“查找-替换 (search & replace)”机制，允许大模型仅替换某几行代码，而非全量重写。
2.  **AST 抽象语法树分析 (Tree-sitter Integration)**:
    * 在 `analyze_file` 中引入 `web-tree-sitter`。
    * 当大模型分析 `.ts/.tsx` 时，向其返回提取的 Class/Function/Interface 签名骨架（Repo Map 概念），大幅降低探索长代码时的 Token 消耗。
3.  **大模型记忆优化 (State Cache Deduplication)**:
    * 在 LangGraph 的 State 中引入基于文件 `mtime` 的缓存机制，若大模型重复读取同一未修改的文件，Tool 返回占位符 `<system-reminder>FILE_UNCHANGED_STUB</system-reminder>` 以节省上下文空间。
