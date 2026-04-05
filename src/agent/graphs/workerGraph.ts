import { StateGraph, START, END } from "@langchain/langgraph";
import { ToolNode } from "@langchain/langgraph/prebuilt";
import { SystemMessage, HumanMessage, AIMessage } from "@langchain/core/messages";
import { SubAgentStateAnnotation } from "../state";
import type { AgentDefinition } from "../config/agents";
import type { StructuredTool } from "@langchain/core/tools";

/**
 * 独立子智能体图工厂 (Sub-Graph Factory)
 * 完美体现 Methodology 1: Default Isolation (只读写 SubAgentStateAnnotation)
 * 这个工厂函数彻底盘活了我们前两个阶段的准备工作：
 *
 * 高度自治的闭环：这个 Workflow 内部只有 agent 和 tools 两个节点互相“踢皮球”。比如 Explore Agent 会在这个图里不断地 agent(查哪) -> tools(执行搜索) -> agent(看结果继续查)，这一切都只累积在 localMessages 中，绝不污染外层主应用的 Token。
 *
 * 动态上下文裁剪 (omitHeavyContext)：我们在 agentNode 中拦截了 heavyContext。如果 agentDef.omitHeavyContext 为 true，那么像 Explore 这种只读探路者就只会带着极轻量的 currentTask 轻装上阵，完美实现 Token 节约。
 *
 * 抗遗忘机制注入：criticalReminder 被无缝拼接在 System Prompt 的最末尾。这是提示词工程（Prompt Engineering）中权重最高的位置，专门用来对付 Verifier Agent 的“偷懒逃避心理”。
 */
export function createWorkerGraph(
    agentDef: AgentDefinition,
    tools: StructuredTool[],
    llmModel: any // 你的统一模型实例 (如 ChatOpenAI 或统一的 createModel 产物)
) {
    // 1. 绑定当前 Agent 专属的隔离工具包
    const modelWithTools = tools.length > 0 ? llmModel.bindTools(tools) : llmModel;

    // 2. 定义核心思考节点 (Agent Node)
    const agentNode = async (state: typeof SubAgentStateAnnotation.State) => {
        const messages = [];

        // --- 组装系统 Prompt ---
        let systemPromptText = agentDef.systemPrompt;
        if (agentDef.criticalReminder) {
            // 强制在底部注入抗遗忘约束
            systemPromptText += `\n\n${agentDef.criticalReminder}`;
        }
        messages.push(new SystemMessage(systemPromptText));

        // --- 组装任务上下文 (Methodology 4: Context Trimming) ---
        let taskContext = `[当前任务]:\n${state.currentTask}`;
        if (!agentDef.omitHeavyContext && state.inheritedHeavyContext) {
            taskContext += `\n\n[全局参考上下文]:\n${state.inheritedHeavyContext}`;
        }
        // 我们将任务上下文伪装成人类的首轮输入，锚定模型的注意力
        messages.push(new HumanMessage(taskContext));

        // --- 载入本地冗长对话历史 ---
        // localMessages 包含了子图内部不断的 tool_calls 和 tool_results
        messages.push(...state.localMessages);

        // --- 调用大模型 ---
        const response = await modelWithTools.invoke(messages);

        // 返回增量状态：将最新的 AI 思考/工具调用指令 追加到 localMessages
        return { localMessages: [response] };
    };

    // 3. 定义工具执行节点 (Tool Node)
    // ToolNode 会自动接收 agentNode 产出的 tool_calls，执行我们在 registry 里注册的方法
    const toolNode = new ToolNode(tools);

    // 4. 定义条件路由：决定是继续调用工具，还是思考结束
    const shouldContinue = (state: typeof SubAgentStateAnnotation.State) => {
        const messages = state.localMessages;
        const lastMessage = messages[messages.length - 1] as AIMessage;

        // 如果 LLM 决定调用工具，流转到 'tools' 节点
        if (lastMessage && lastMessage.tool_calls && lastMessage.tool_calls.length > 0) {
            return "tools";
        }
        // 否则，任务结束，流转到 END
        return END;
    };

    // 5. 编排并编译图 (State Machine)
    const workflow = new StateGraph(SubAgentStateAnnotation)
        .addNode("agent", agentNode)
        .addNode("tools", toolNode)
        .addEdge(START, "agent")
        // Agent 思考完毕后，根据结果判断路线
        .addConditionalEdges("agent", shouldContinue)
        // 工具执行完毕后，必须无条件回到 Agent 观察结果并制定下一步
        .addEdge("tools", "agent");

    // 返回编译好的子图应用
    return workflow.compile();
}