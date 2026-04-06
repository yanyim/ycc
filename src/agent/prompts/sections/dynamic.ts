// src/agent/prompts/sections/dynamic.ts

export async function getDynamicEnvContext(workspacePath: string): Promise<string> {
    // [中文注释] 接收从顶层 Orchestrator 贯穿下来的统一工作目录

    // [中文注释] 获取当前的本地时间
    const currentTime = new Date().toLocaleString('zh-CN', { timeZone: 'Asia/Shanghai' });

    return `[ENVIRONMENT CONTEXT]
Current Working Directory: ${workspacePath}
Current Time: ${currentTime}`;
}