import type { CommandContext } from '../../types/command';

export async function runStatus(context: CommandContext) {
    context.setHistory((prev) => [
        ...prev,
        { id: crypto.randomUUID(), role: 'system', content: `[系统状态]: 当前系统运行正常，对话包含 ${context.history.length} 条消息。` }
    ]);
}
