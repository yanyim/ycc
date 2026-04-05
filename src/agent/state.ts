// src/agent/state.ts
import { Annotation, messagesStateReducer } from "@langchain/langgraph";
import { BaseMessage } from "@langchain/core/messages";

/**
 * 1. 全局状态 (Supervisor 主图使用)
 * 遵循“原子性与精简”原则
 */
export const GlobalStateAnnotation = Annotation.Root({
    // 精简后的历史对话 (使用内置的 messagesStateReducer 自动处理增量)
    messages: Annotation<BaseMessage[]>({
        reducer: messagesStateReducer,
        default: () => [],
    }),

    // 当前终端运行的目录
    workspaceCwd: Annotation<string>({
        reducer: (curr, update) => update ?? curr,
        default: () => process.cwd(),
    }),

    // 重量级上下文 (隔离大文件内容，防止污染 messages 导致 Token 爆炸)
    heavyContext: Annotation<string>({
        reducer: (curr, update) => update, // 直接覆盖更新
        default: () => "",
    }),

    // 统筹者的路由指针
    nextWorker: Annotation<string>({
        reducer: (curr, update) => update,
        default: () => "supervisor",
    }),

    // 用于在节点之间传递给 UI 的状态机流转信息
    taskStatus: Annotation<'running' | 'interrupted' | 'completed' | 'error'>({
        reducer: (curr, update) => update,
        default: () => 'running',
    }),
});

/**
 * 2. 子图状态 (Worker SubGraph 使用)
 * 遵循“默认隔离”原则。Worker 自己的啰嗦对话不进全局 messages
 */
export const SubAgentStateAnnotation = Annotation.Root({
    // 子图内部的对话流 (包含大量的 tool_calls 和 tool_results)
    messages: Annotation<BaseMessage[]>({
        reducer: messagesStateReducer,
        default: () => [],
    }),

    // 从主图继承下来的当前任务指令
    currentTask: Annotation<string>({
        reducer: (curr, update) => update ?? curr,
        default: () => "",
    }),

    // 如果 Agent 配置为不忽略 heavyContext，则传入此字段
    inheritedHeavyContext: Annotation<string>({
        reducer: (curr, update) => update ?? curr,
        default: () => "",
    }),

    // 最终提炼的结果，准备提交回给主图
    extractedResult: Annotation<string>({
        reducer: (curr, update) => update,
        default: () => "",
    })
});