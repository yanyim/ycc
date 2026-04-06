// src/agent/graphs/workerGraph.ts
import { END, START, StateGraph } from "@langchain/langgraph";
import { ToolNode } from "@langchain/langgraph/prebuilt";
import { AIMessage, HumanMessage, SystemMessage } from "@langchain/core/messages";
import { SubAgentStateAnnotation } from "../state";
import type { AgentDefinition } from "../config/agents";
import type { StructuredTool } from "@langchain/core/tools";
// 🌟 引入刚写好的装配厂
import { buildSystemPrompt } from "../prompts/builder";

export function createWorkerGraph(
    agentDef: AgentDefinition,
    tools: StructuredTool[],
    llmModel: any,
    workspacePath: string, // 🌟 新增参数：从 orchestrator 传下来的统一路径
    delayMs: number = 0
) {
    const modelWithTools = tools.length > 0 ? llmModel.bindTools(tools) : llmModel;

    const agentNode = async (state: typeof SubAgentStateAnnotation.State, config: any) => {
        const messages = [];

        // ==========================================================
        // 1. 组装 System Prompt (动静分离，最大化缓存命中)
        // ==========================================================
        const systemPromptText = await buildSystemPrompt(
            agentDef,
            tools.map(t => t.name),
            workspacePath
        );
        messages.push(new SystemMessage(systemPromptText));

        // ==========================================================
        // 2. 组装 User Context (任务指令与防遗忘机制)
        // ==========================================================
        let taskContext = `[CURRENT TASK]:\n${state.currentTask}`;

        // 追加沉重的全局上下文 (放在这里不会破坏 System 的前缀缓存)
        if (!agentDef.omitHeavyContext && state.inheritedHeavyContext) {
            taskContext += `\n\n[REFERENCE CONTEXT]:\n${state.inheritedHeavyContext}`;
        }

        // 🌟 核心技巧：抗遗忘机制 (Anti-Forgetting Mechanism)
        // 将 criticalReminder 强行拼接在最新一条 HumanMessage 的最底部！
        // 距离模型输出越近的内容，模型的注意力 (Attention) 权重越高。
        if (agentDef.criticalReminder) {
            taskContext += `\n\n${agentDef.criticalReminder}`;
        }

        messages.push(new HumanMessage(taskContext));

        // 3. 压入子图本地的历史对话
        messages.push(...state.messages);

        if (delayMs > 0) {
            await new Promise(resolve => setTimeout(resolve, delayMs));
        }

        // --- 调用大模型 ---
        const response = await modelWithTools.invoke(messages, config);

        if (response.tool_calls && response.tool_calls.length > 0) {
            return { messages: [response] };
        } else {
            return {
                messages: [response],
                extractedResult: String(response.content)
            };
        }
    };

    const toolNode = new ToolNode(tools);

    const shouldContinue = (state: typeof SubAgentStateAnnotation.State) => {
        const messages = state.messages;
        const lastMessage = messages[messages.length - 1] as AIMessage;

        if (lastMessage && lastMessage.tool_calls && lastMessage.tool_calls.length > 0) {
            return "tools";
        }
        return END;
    };

    const workflow = new StateGraph(SubAgentStateAnnotation)
        .addNode("agent", agentNode)
        .addNode("tools", toolNode)
        .addEdge(START, "agent")
        .addConditionalEdges("agent", shouldContinue)
        .addEdge("tools", "agent");

    return workflow.compile();
}