---

# 📖 架构笔记：LangGraph 多智能体团队拓扑重构 (Graph-as-a-Team)

## 一、 核心痛点复盘
在初版架构中，我们的 `TeamDefinition` 仅仅是一个“人员花名册”（包含了智能体角色和 Prompt），而团队的工作流程（谁把任务交给谁）被**硬编码**在了 `TeamOrchestrator` 中。

* **架构瓶颈**：被锁死的“星型拓扑（Hub-and-Spoke）”。
* **表现**：无论什么任务，都必须走 `Start -> Supervisor -> Worker -> Supervisor -> End` 的流程。无法为特定任务（如单纯的代码翻译、流水线审核）建立无大老板的“直线型”协作流程。

## 二、 核心演进理念：图即团队 (Graph-as-a-Team)
在 LangGraph 的最佳抽象中，**团队（Team）的定义不仅仅是“有哪些成员（Nodes）”，更必须包含“成员之间如何协作（Edges & Routing）”。**

因此，团队重构的第一性原理是：**将流转图（Graph）的组装权，从中央调度器下放给各个团队自己。**

### 拓扑结构的三种终极形态：
1. **监管者模式 (Supervisor / Star)**：包含大老板中枢，适合需求不明确、需要动态路由的复杂探索任务（如当前的 `CODING_TEAM`）。
2. **流水线模式 (Pipeline / Sequential)**：无中枢，节点串行。适合标准化 SOP 任务（如：文档读取 -> 翻译 -> 审查 -> 产出）。
3. **层级模式 (Hierarchical / Nested)**：大图套小图。大老板将任务派发给“前端团队子图”和“后端团队子图”。

---

# 🏗️ 开发设计大纲 (Implementation Outline)

后续的重构开发请按照以下三个阶段进行：

## 阶段 1：重定义 Team 接口规范 (`src/agent/config/teams.ts`)
**目标**：为团队注入图的“编译权”。

* 修改 `TeamDefinition` 接口，移除/淡化 `members` 和 `supervisorPrompt` 这种只服务于星型拓扑的属性。
* **新增核心方法**：`buildTeamGraph`。
```typescript
import { Runnable } from "@langchain/core/runnables";
import { CodeToolRegistry } from "../tools/registry";

export interface TeamDefinition {
    id: string;
    name: string;
    description: string;
    
    // 核心接口：团队必须自己返回一个编译好的 LangGraph
    buildTeamGraph: (
        llmModel: any, 
        toolRegistry: CodeToolRegistry, 
        workspacePath: string
    ) => Runnable; 
}
```

## 阶段 2：实现具体的团队拓扑 (在 `teams/` 目录下拆分)
**目标**：利用通用的 `createWorkerGraph`，组装不同形态的团队。

### 场景 A：重构现有的核心研发团队 (星型拓扑)
* **路径**：新建 `src/agent/config/teams/CodingTeam.ts`。
* **逻辑**：将原本在 `orchestrator.ts` 里写的 Supervisor 节点、条件路由（Conditional Edges）、以及动态注册 Worker 节点的 `for` 循环，全部迁移到这个类的 `buildTeamGraph` 方法中。

### 场景 B：新增一个代码翻译团队 (流水线拓扑)
* **路径**：新建 `src/agent/config/teams/TranslationTeam.ts`。
* **逻辑**：不使用 Supervisor。直接组装 `ReaderNode -> TranslatorNode -> VerifierNode`。
* **图结构**：
  ```typescript
  const workflow = new StateGraph(GlobalStateAnnotation)
      .addNode("reader", readerNode)
      .addNode("translator", translatorNode)
      .addEdge(START, "reader")
      .addEdge("reader", "translator")
      .addEdge("translator", END);
  return workflow.compile();
  ```

## 阶段 3：为 Orchestrator “瘦身” (`src/agent/orchestrator.ts`)
**目标**：让大管家回归“执行者”与“事件广播器”的本质。

* **移除**：删除 `buildGlobalGraph` 方法中所有关于节点组装、路由判断的硬编码逻辑。
* **接入**：在构造函数中，直接调用当前激活团队的 `buildTeamGraph` 方法获取图实例。
* **保留**：保留 `executeTask` 这一核心方法，因为 `streamEvents` V2 的底层事件穿透机制依然完美适用于任何形态的图。

```typescript
export class TeamOrchestrator {
    private graph: any;

    constructor(teamDef: TeamDefinition, llmModel: any, workspacePath: string) {
        const toolRegistry = new CodeToolRegistry(workspacePath);
        // 极致优雅：一键获取组装好的黑盒团队
        this.graph = teamDef.buildTeamGraph(llmModel, toolRegistry, workspacePath);
    }
    
    public async* executeTask(chatHistory) {
        // ... 原有的 streamEvents 逻辑保持不变 ...
    }
}
```

---

## 🎯 预期收益 (Expected Benefits)
1. **符合开闭原则 (OCP)**：未来新增任何奇葩流程的 AI 团队，都不需要再修改 `orchestrator.ts`，只需新增一个 `Team` 定义文件并注册即可。
2. **极高的复用性**：底层的 `createWorkerGraph` 依然作为“标准打工人工位”被各个团队复用。
3. **消除抽象泄露**：真正实现了 LangGraph 的终极奥义——**万物皆图，图可嵌套**。