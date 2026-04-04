import type { CommandContext } from '../../types/command';

export async function runStatus(context: CommandContext) {
    // 🌟 替换为调用 Store 注入的方法
    await context.addMessage({
        id: crypto.randomUUID(),
        role: 'system',
        content: `[系统状态]: 当前系统运行正常，对话包含 ${context.messages.length} 条消息。`
    });
}