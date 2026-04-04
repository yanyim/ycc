// src/commands/clear/clearImpl.ts
import type { CommandContext } from '../../types/command';

export async function runClear(context: CommandContext) {
    // 1. 获取当前终端窗口的行数 (默认兜底 50 行)
    const rows = process.stdout.rows || 50;

    // 2. 利用 Ink 兼容的 console.log 连续输出空行
    // 这会将旧的历史记录推出版面，达到“视觉清屏”的效果，且绝对不会破坏 Ink 的渲染树
    console.log('\n'.repeat(rows));

    // 3. 清空 Zustand 状态和本地持久化的 JSON 文件
    await context.clearMessages();

    // 4. (可选) 给用户一个友好的新开始提示
    await context.addMessage({
        id: crypto.randomUUID(),
        role: 'system',
        content: '🧹 屏幕与对话上下文已清空，开启全新话题。'
    });
}