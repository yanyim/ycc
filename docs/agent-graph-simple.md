### 🌍 我们目前的架构全景图（复盘）

我们可以把这个 Code CLI 想象成一个**“微型软件外包公司”**。目前，我们已经完成了这家公司的**规章制度、武器库和打工人的工位搭建**。

* **阶段一：规章制度 (`config/agents.ts` & `state.ts`)**
    * **我们做了什么：** 定义了公司的职位描述（`AgentDefinition`）和会议室规则（`StateAnnotation`）。
    * **核心成就：** 明确了“探路者 (Explore)”、“程序员 (Coder)”、“测试员 (Verifier)”的职责，并且规定了**大老板（Supervisor）的会议室（GlobalState）和普通员工的工位（SubAgentState）是物理隔离的**。
* **阶段二：武器库与门禁 (`tools/file-system/` & `registry.ts`)**
    * **我们做了什么：** 你亲手写了安全、防溢出的底层文件操作工具，我们又包了一层 `CodeToolRegistry`。
    * **核心成就：** 这相当于给每个员工发工具箱。探路者去领工具，门禁系统（Isolation Policy）绝不会给他发“写文件”的工具。如果模型发疯想删代码，在门禁这里就会被拦截。
* **阶段三：打工人工位流水线 (`workerGraph.ts`)**
    * **我们做了什么：** 我们写了一个“通用的流水线车间创建器”（`createWorkerGraph`）。
    * **核心成就：** 把职位描述（Prompt）、工具箱（Tools）和大模型（LLM）扔进去，就能实例化出一个个独立运转的“打工人”。他们在自己的车间里（Sub-graph）拼命工作、查资料、自言自语（`localMessages`），**外界根本听不到他们的废话**。

---

### 💡 核心解答：大老板（Supervisor）如何指挥这些打工人？

你问到了最关键的问题：**在 LangGraph 中，主图的主节点（Supervisor）是如何调用并回收这些独立子图（Sub-Graphs）结果的？**

这里有一个非常优雅的“第一性原理”：**在 LangChain/LangGraph 的世界里，一个编译好的图（Compiled Graph）本身就是一个可执行的节点（Runnable）！**

在接下来的**阶段四**中，我们的运作逻辑是这样的：

1.  **大老板下达指令 (Supervisor Node)：**
    主图的 Supervisor 节点（一个只有大模型、没有工具的节点）看了用户的要求，决定：“这活儿该交给探路者”。它把全局的 `nextWorker` 状态改为 `"explorer"`。
2.  **主图路由 (Conditional Edge)：**
    主图的路由器看到 `"explorer"`，就会把状态流转给主图里的 `ExploreWorkerNode`（探路者节点）。
3.  **唤醒子图并传递参数 (Invoke Sub-Graph)：**
    这步是魔法所在。`ExploreWorkerNode` 内部**不是**直接调大模型，而是调用我们在**阶段三**编译出来的子图！它会把全局状态（GlobalState）里的指令“翻译”成子状态（SubAgentState）丢进去：
    ```typescript
    // 伪代码演示：主图节点如何调用子图
    async function ExploreWorkerNode(globalState) {
        // 1. 唤醒探路者子图
        const resultState = await exploreSubGraph.invoke({
            currentTask: "去搜一下 auth.ts",
            // localMessages 自动从空数组开始
        });

        // 2. 子图在内部跑了几十轮，终于得出了结论
        const summary = resultState.localMessages[最后一条];

        // 3. 把精华结论带回给大老板的全局会议室
        return {
            messages: [new AIMessage(`探路者汇报: ${summary.content}`)]
        };
    }
    ```

### 总结与下一步
你现在可以把子图（WorkerGraph）看作是一个个**高度智能、自带沙箱的超级函数 (Super Function)**。无论它内部循环了多少次、翻了多少文件，对于外层的主图来说，**它就是一次函数调用，进出只有一次，返回的只有精华**。

这就完美实现了**防污染**和**可控性**。