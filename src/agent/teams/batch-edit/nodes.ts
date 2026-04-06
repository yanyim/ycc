// src/agent/teams/batch-edit/nodes.ts
import { AIMessage, HumanMessage, SystemMessage } from "@langchain/core/messages";
import { BatchEditStateAnnotation } from "./state";
import { ANALYZER_SYSTEM_PROMPT, EDITOR_SYSTEM_PROMPT } from "./prompts";
import { ToolNode } from "@langchain/langgraph/prebuilt";
import { ToolMessage } from "@langchain/core/messages";

// ==========================================
// 1. 分析员节点 (Analyzer Node)
// ==========================================
export function createAnalyzerNode(llmModel: any, tools: any[]) {
    // 为 Analyzer 绑定它的专属工具 (找文件的工具)
    const analyzerModel = tools.length > 0 ? llmModel.bindTools(tools) : llmModel;

    return async (state: typeof BatchEditStateAnnotation.State, config: any) => {
        // 组装 Prompt：静态系统提示词 + 宏观任务
        const messages = [
            new SystemMessage(ANALYZER_SYSTEM_PROMPT),
            new HumanMessage(`[MACRO TASK]:\n${state.macroTask}`), // 注入大老板下发的任务
            ...state.messages // 压入 Analyzer 自己在子图中调用工具的局部对话
        ];

        // 调用大模型
        const response = await analyzerModel.invoke(messages, config);

        // 如果模型调用了工具，或者还在说话，正常返回并追加到局部 messages 里
        // 这里的 pendingTasks 我们不在 Node 里解析，而是交由专门的工具或最终输出解析
        return { messages: [response] };
    };
}


// ==========================================
// 2. 编辑员节点 (Editor Node)
// ==========================================
export function createEditorNode(llmModel: any, tools: any[]) {
    // 为 Editor 绑定读写工具
    const editorModel = tools.length > 0 ? llmModel.bindTools(tools) : llmModel;

    return async (state: typeof BatchEditStateAnnotation.State, config: any) => {
        // 🌟 核心防线：无状态执行 (Stateless Worker)
        // 我们绝对不传入 state.messages (不带入之前改其他文件的历史)

        // 提取当前要处理的文件 (队列的第一个)
        const currentTargetFile = state.pendingTasks[0];

        // 如果队列空了，直接返回 (正常不会走到这里，靠条件路由拦截)
        if (!currentTargetFile) return {};

        // 构造前情提要：已完成的修改日志
        const changelogText = state.completedChanges.length > 0
            ? state.completedChanges.map((log, i) => `${i + 1}. ${log}`).join('\n')
            : "No changes completed yet.";

        const editorContext = `[MACRO TASK]:\n${state.macroTask}\n\n` +
            `[COMPLETED CHANGES (For Context Only)]:\n${changelogText}\n\n` +
            `[YOUR CURRENT ASSIGNMENT]:\nFocus strictly on editing this file: ${currentTargetFile}`;

        const messages = [
            new SystemMessage(EDITOR_SYSTEM_PROMPT),
            new HumanMessage(editorContext)
        ];

        const response = await editorModel.invoke(messages, config);

        return {
            // 注意：Editor 的啰嗦过程也不进主 messages，防止污染。
            // 它的输出我们将通过另一个节点或工具来解析，生成 changelog。
            messages: [response]
        };
    };
}

// ==========================================
// 3. 智能工具拦截器 (Analyzer Tool Interceptor)
// ==========================================
export function createAnalyzerToolNode(tools: any[]) {
    // 实例化官方的底层 ToolNode
    const baseToolNode = new ToolNode(tools);

    return async (state: typeof BatchEditStateAnnotation.State, config: any) => {
        // 1. 让底层 ToolNode 去真实地执行工具
        // 我们通过 invoke 唤醒它，它会返回一个包含 ToolMessage 的状态增量
        const result = await baseToolNode.invoke(state, config);

        // 获取刚刚执行产生的结果消息
        const toolMessages = result.messages as ToolMessage[];

        // 2. 探针逻辑：检查工具输出是否为典型的失败特征词
        let isFailure = false;

        for (const msg of toolMessages) {
            const content = String(msg.content);

            // 匹配我们在底层文件系统中写的各种报错和未命中提示
            if (
                content.includes("No matches found.") || // grep_search 没找到
                content.includes("No files found") ||    // list_files 没找到
                content.includes("Error:") ||            // 文件不存在等报错
                content.includes("Search error:")
            ) {
                isFailure = true;
            } else {
                // 🌟 只要这一次并行调用的多个工具中，有【任意一个】成功返回了有效代码或列表
                // 我们就认为这次探索是【成功】的，直接清零失败计数！
                isFailure = false;
                break;
            }
        }

        // 3. 拦截并组装最终的 State 补丁
        return {
            messages: toolMessages, // 依然要把工具的输出返回给对话流，让大模型看到

            // 触发我们在 State 里写好的 Reducer
            // 如果失败，抛出数字 1 进行累加；如果成功，抛出 RESET 信号清零
            consecutiveFailures: isFailure ? 1 : 'RESET'
        };
    };
}