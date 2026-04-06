# 🚀 Code CLI 多智能体架构演进与重构笔记

## 一、 核心架构思想：从“微操大师”到“图即团队 (Graph-as-a-Team)”

### 1. 过去的设计 (The Past: Monolithic Orchestrator)
* **痛点**：调度器 (`Orchestrator`) 承载了太多的业务逻辑，它硬编码了“星型拓扑（Supervisor 居中调度）”。所有的团队只能复用这一套规章制度。
* **致命伤**：无法应对类似“批量修改跨文件代码”的任务。大老板（Supervisor）每次分发任务都会导致上下文如雪球般滚动，最终引发 Token 爆炸和无限死循环。

### 2. 现在的设计 (The Present: Graph-as-a-Team & IoC)
* **控制反转 (IoC)**：我们将图的**“组装权”彻底下放给了 `TeamDefinition` 本身**。
* **架构蜕变**：
    * `Orchestrator` 退化为一个纯粹的**“执行引擎外壳”**。它不再关心团队里有没有大老板、是不是流水线，它只负责调用 `teamDef.buildTeamGraph()` 拿到图，然后无脑执行 `streamEvents`。
    * `TeamDefinition` 成为一个真正的**插件 (Plugin)**。不同的团队可以自由决定自己内部的协作拓扑（图结构）。

---

## 二、 核心数据流转与拓扑解剖

目前系统内注册了两支截然不同的特种部队，它们代表了多智能体领域的两大经典心智模型：

### 1. 核心研发团队 (`coding/index.ts`) —— 应对未知与零散需求
* **心智模型**：ReAct + Supervisor (星型拓扑)
* **数据流转**：`START -> Supervisor -> 意图识别路由 -> Worker (Explorer/Coder/Verifier) -> Supervisor -> 循环或 END`。
* **特点**：全靠大模型的聪明才智现场发挥。灵活，但成本高，适合开放式聊天和散粒指令。

### 2. 批量重构团队 (`batch-edit/index.ts`) —— 应对明确 SOP 与高危批量任务
* **心智模型**：Plan-and-Solve (计划与执行流水线)
* **数据流转**：
    1. **Analyzer (计划者)**：进入封闭循环，多次调用 `grep_search/list_files` 摸清底细。最终输出 `pendingTasks` 清单。
    2. **Editor (执行者)**：只读写这一个文件。
    3. **TaskCleanup (幽灵节点)**：不调用大模型，纯代码执行队列 `shift()` 弹出任务，并记录变更日志。
    4. **条件路由**：如果队列还有任务，转回 Editor；如果为空，转至 END。
* **特点**：任务拆解极度清晰，Token 消耗极低，无老板干预。

---

## 三、 关键点处理方法：工业级防线 (The 5 Defenses)

这是本次重构中最有技术含量的部分，解决了 AI Agent 落地的五大天坑：

### 防线 1：破解“智能体死亡循环” (Agentic Loop of Death)
* **痛点**：找代码找不到时，大模型会疯狂穷举工具，吸干 Token。
* **解决思路 (三级火箭)**：
    1. **Prompt 软限制**：明文规定“连续 3 次失败必须放弃”。
    2. **智能拦截器 (Tool Interceptor)**：拦截官方 `ToolNode` 的输出。如果结果包含 "No matches found"，则发送 `1` 给状态机累加；如果成功，发送 `'RESET'` 信号清零。
    3. **路由硬熔断**：条件路由中判断 `if (state.consecutiveFailures >= 3) return END;`。

### 防线 2：破解 LangGraph 数组状态覆盖陷阱
* **痛点**：默认的数组 Reducer 会把新老数据合并（Append），导致 `pendingTasks` 越积越多。
* **解决思路**：在 `state.ts` 中，为特定的消费队列显式指定**覆写逻辑** `reducer: (curr, update) => update`。

### 防线 3：破解上下文滚雪球与幻觉 (Context Snowball)
* **痛点**：Editor 循环改到第 10 个文件时，带着前 9 个文件的源码上下文，导致大脑死机。
* **解决思路**：**无状态执行 (Stateless Worker)**。在 `EditorNode` 中，强制隔离 `state.messages`，每次只传给大模型三样东西：1. 宏观任务；2. 历史摘要；3. 当前文件路径。

### 防线 4：破解跨文件幽灵上下文
* **痛点**：Editor 无状态后，忘了前一个文件提取了什么公共组件，导致重复造轮子。
* **解决思路**：设立增量追加的 `completedChanges` 数组。`TaskCleanup` 节点负责把上一轮 Editor 的总结压缩成一句话，注入到下一轮 Editor 的 `SystemPrompt` 动态段中，作为前情提要。

### 防线 5：破解行号偏移灾难 (Line-Shift Disaster)
* **痛点**：Analyzer 在清单里写死了“修改第 10-20 行”，由于其他文件的修改导致行号变动，Editor 去改时直接删错代码。
* **解决思路**：推迟精准定位的发生时机。Analyzer 只能输出**纯路径**（如 `src/App.tsx`）。强迫 Editor 遵循 **“修改前必读 (READ BEFORE WRITE)”** 规则，现场调 `read_file` 查阅带行号的最新代码，再实施 `edit_file`。

---

## 四、 核心目录与代码映射指南

通过统一目录结构，项目现在实现了真正的“插件化”。

```text
src/agent/
├── config/
│   ├── agents.ts         # 打工人身份定义 (EXPLORE_AGENT, CODER_AGENT 等)
│   └── teams.ts          # 极其干净的注册表，定义 TeamDefinition 接口并导出 TEAM_REGISTRY
├── graphs/
│   └── workerGraph.ts    # 通用打工人小图：负责处理防遗忘机制和工具执行闭环
├── teams/                # 🌟 所有具体的智能体编排逻辑全在这里！
│   ├── coding/
│   │   └── index.ts      # 实现大老板带小弟的“星型拓扑”
│   └── batch-edit/
│       ├── index.ts      # 实现 Analyzer -> Editor 循环的“流水线拓扑”
│       ├── nodes.ts      # 包含重构专用的无状态 EditorNode 和 Tool拦截器
│       ├── prompts.ts    # 包含带有硬约束的特种提示词
│       └── state.ts      # 包含防死循环计数器和任务队列的特种 State
├── orchestrator.ts       # 🌟 瘦身后的执行引擎外壳，只负责调用 buildTeamGraph 和 streamEvents
└── state.ts              # 全局默认 State
```

## 五、 总结与未来心智模型

这次重构赋予了你一个非常清晰的**扩展框架**。

未来，当你在使用 CLI 开发时，如果发现大模型在某项任务上**“又贵又蠢”**，你的第一反应不再是去改它那长篇大论的 Prompt，而是应该思考：
**“这是否是一个具备明确 SOP（标准作业程序）的任务？”**

如果是，比如你想做一个“自动写单元测试”的功能：
1. 去 `teams/` 下建一个 `unit-test/` 目录。
2. 定义专属的 State（比如加入 `testCoverage` 字段）。
3. 连线一个 `Reader -> Generator -> Tester` 的流水线图。
4. 将其注册到 `config/teams.ts`。
5. 终端一行命令 `/agent unit-test`，它就能极其稳定且廉价地跑起来。

你现在拥有的是一套极具生命力的现代 AI 架构底座，去享受控制它的乐趣吧！