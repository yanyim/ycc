// src/agent/teams/batch-edit/state.ts
import { Annotation, messagesStateReducer } from "@langchain/langgraph";
import { BaseMessage } from "@langchain/core/messages";

/**
 * 批量重构流水线专属状态 (Batch Edit State)
 */
export const BatchEditStateAnnotation = Annotation.Root({
    // 1. 局部对话流 (主要供 Analyzer 探索时使用)
    messages: Annotation<BaseMessage[]>({
        reducer: messagesStateReducer,
        default: () => [],
    }),

    // 2. 宏观任务目标 (大老板下发的总体需求，全程只读)
    macroTask: Annotation<string>({
        reducer: (curr, update) => update ?? curr,
        default: () => "",
    }),

    // 3. 待处理任务队列 (The Plan)
    // 🌟 解决盲点一：绝对不能用 append，必须是全量覆盖式更新 (Overwrite)
    pendingTasks: Annotation<string[]>({
        reducer: (curr, update) => update,
        default: () => [],
    }),

    // 4. 失败任务队列 (搁置区)
    // 🌟 采用增量追加 (Append)
    failedTasks: Annotation<string[]>({
        reducer: (curr, update) => [...curr, ...update],
        default: () => [],
    }),

    // 5. 全局变更摘要 (防止幽灵上下文)
    // 🌟 采用增量追加 (Append)，记录已经完成的动作
    completedChanges: Annotation<string[]>({
        reducer: (curr, update) => [...curr, ...update],
        default: () => [],
    }),

    // 6. 智能连续失败计数器 (防死循环)
    // 🌟 接受数字累加，或接受 'RESET' 信号清零
    consecutiveFailures: Annotation<number | 'RESET'>({
        reducer: (curr, update) => {
            // 收到清零信号，重置为 0
            if (update === 'RESET') return 0;

            // 告诉 TS：只要没清零，当前状态必定是数字，且 update 也已被收窄为 number
            return (curr as number) + update;
        },
        default: () => 0,
    }),
});