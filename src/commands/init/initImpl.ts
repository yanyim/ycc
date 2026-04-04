// src/commands/init/initImpl.ts
import { promises as fs } from 'fs';
import path from 'path';
import { CLI_DIR, SESSIONS_DIR } from '../../storage/storage';
import type { CommandContext } from '../../types/command';

export async function runInit(context: CommandContext) {
    try {
        // 1. 确保核心目录存在 (recursive: true 会自动创建多级目录且存在时不报错)
        await fs.mkdir(CLI_DIR, { recursive: true });
        await fs.mkdir(SESSIONS_DIR, { recursive: true });

        // 2. 检查并初始化默认配置
        const configPath = path.join(CLI_DIR, 'config.json');
        let isCreated = false;

        try {
            await fs.access(configPath);
            // 如果没抛出异常，说明文件已存在
        } catch {
            // 文件不存在，写入干净的、没有冗余嵌套的默认 JSON 配置
            const defaultConfig = {
                state: {
                    modelConfig: { provider: 'openai', model: 'gpt-3.5-turbo' }
                },
                version: 0
            };

            // 使用 JSON.stringify 进行格式化排版 (null, 2)
            await fs.writeFile(configPath, JSON.stringify(defaultConfig, null, 2), 'utf-8');
            isCreated = true;
        }

        // 3. 使用全新的 context.addMessage 将执行结果推入会话中
        await context.addMessage({
            id: crypto.randomUUID(),
            role: 'system',
            content: `✅ [初始化成功]\n- 工作目录: ${CLI_DIR}\n- 会话目录: ${SESSIONS_DIR}\n- 配置文件: ${isCreated ? '已写入默认配置' : '文件已存在，跳过覆盖'}`
        });

    } catch (error: any) {
        // 错误处理也同步改为 addMessage
        await context.addMessage({
            id: crypto.randomUUID(),
            role: 'system',
            content: `❌ [初始化失败]: ${error.message}`
        });
    }
}