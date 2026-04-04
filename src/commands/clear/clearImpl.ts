import type { CommandContext } from '../../types/command';

export async function runClear(context: CommandContext) {
    console.clear();
    // 🌟 替换为调用 Store 注入的方法
    await context.clearMessages();
}