// src/agent/teams/batch-edit/index.ts
import {END, START, StateGraph} from "@langchain/langgraph";
import {ToolNode} from "@langchain/langgraph/prebuilt";
import {BatchEditStateAnnotation} from "./state";
import {createAnalyzerNode, createAnalyzerToolNode, createEditorNode} from "./nodes";
import type {TeamDefinition} from "../../config/teams";
import {AIMessage} from "@langchain/core/messages";

// ==========================================
// 1. 智能条件路由 (Conditional Edges)
// ==========================================

/**
 * 分析员路由逻辑：控制探索循环，并在出清单后流转给编辑员
 */
const shouldContinueAnalyzer = (state: typeof BatchEditStateAnnotation.State) => {
    // 🌟 防线 1：智能连续失败熔断！(增加 as number 类型断言)
    if ((state.consecutiveFailures as number) >= 3) {
        console.warn("[系统拦截]: 连续失败达到 3 次，强制终止分析。");
        return END;
    }

    const messages = state.messages;
    const lastMessage = messages[messages.length - 1] as AIMessage;

    // 如果大模型决定调用工具 (找文件)
    if (lastMessage?.tool_calls?.length) {
        return "analyzerTools";
    }

    // 如果大模型没有调工具，说明它输出了最终的文字结论
    // 我们检查 pendingTasks 队列，如果有任务，流转给 Editor；否则直接结束
    if (state.pendingTasks && state.pendingTasks.length > 0) {
        return "editor";
    }

    return END;
};

/**
 * 编辑员路由逻辑：控制编辑工具调用，或流转给队列清理节点
 */
const shouldContinueEditor = (state: typeof BatchEditStateAnnotation.State) => {
    const messages = state.messages;
    const lastMessage = messages[messages.length - 1] as AIMessage;

    // 如果需要读取或修改文件，流转给工具节点
    if (lastMessage?.tool_calls?.length) {
        return "editorTools";
    }

    // 如果没调工具，说明当前这个文件改完了（或者放弃了）
    // 流转给专门的队列消费节点
    return "taskCleanup";
};

// ==========================================
// 2. 队列消费与日志沉淀节点 (Task Cleanup Node)
// ==========================================
/**
 * 这是一个极轻量的“幽灵节点”，没有任何大模型参与。
 * 它纯粹用于在代码层面上安全地消费 pendingTasks 队列，并记录已完成日志。
 */
const taskCleanupNode = async (state: typeof BatchEditStateAnnotation.State) => {
    const currentQueue = [...state.pendingTasks];
    const completedFile = currentQueue.shift(); // 🌟 弹出刚刚做完的第一个任务

    const messages = state.messages;
    const lastMessage = messages[messages.length - 1];

    // 提取 Editor 的最后一句总结，作为变更摘要
    const summary = typeof lastMessage?.content === "string"
        ? lastMessage.content
        : "Modified without specific summary.";

    return {
        pendingTasks: currentQueue, // 覆写队列 (少了一个)
        completedChanges: [`[${completedFile}]: ${summary}`], // 增量追加到变更历史
    };
};

/**
 * 队列清理后的路由判断
 */
const afterCleanupRoute = (state: typeof BatchEditStateAnnotation.State) => {
    // 如果队列里还有任务，继续唤醒 Editor 处理下一个
    if (state.pendingTasks.length > 0) {
        return "editor";
    }
    // 队列清空，流水线完美收工
    return END;
};


// ==========================================
// 3. 组装并导出特种团队 (The Team Definition)
// ==========================================
export const BATCH_REFACTOR_TEAM: TeamDefinition = {
    id: 'batch-refactor',
    name: '批量重构特种部队',
    description: '采用【先分析出清单、再循环执行】的模式，专治跨多个文件的批量修改。自带防死循环与状态隔离。',

    buildTeamGraph: (llmModel, toolRegistry, workspacePath) => {

        // 我们利用你之前写好的工具漏斗，为不同的角色分发不同的工具套餐
        // 分析员只读，编辑员读写
        const analyzerTools = toolRegistry.resolveToolsForAgent({allowedTools: ['list_files', 'read_file', 'grep_search']} as any);
        const editorTools = toolRegistry.resolveToolsForAgent({allowedTools: ['read_file', 'edit_file']} as any);

        const analyzerNode = createAnalyzerNode(llmModel, analyzerTools);
        const editorNode = createEditorNode(llmModel, editorTools);

        // 🌟 使用我们刚刚写的智能拦截器包裹 analyzerTools！
        const smartAnalyzerToolNode = createAnalyzerToolNode(analyzerTools);

        const workflow = new StateGraph(BatchEditStateAnnotation)
            .addNode("analyzer", analyzerNode)
            .addNode("analyzerTools", smartAnalyzerToolNode)
            .addNode("editor", editorNode)
            .addNode("editorTools", new ToolNode(editorTools))
            .addNode("taskCleanup", taskCleanupNode)

            // ---------------- 拓扑边缘连线 ----------------
            .addEdge(START, "analyzer")
            .addConditionalEdges("analyzer", shouldContinueAnalyzer)
            .addEdge("analyzerTools", "analyzer")
            .addConditionalEdges("editor", shouldContinueEditor)
            .addEdge("editorTools", "editor")
            .addConditionalEdges("taskCleanup", afterCleanupRoute);

        return workflow.compile();
    }
};