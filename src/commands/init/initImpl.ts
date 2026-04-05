// src/commands/init/initImpl.ts
import { promises as fs } from 'fs';
import path from 'path';
import { CLI_DIR, SESSIONS_DIR } from '../../storage/storage';
import type { CommandContext } from '../../types/command';
import { models as defaultModels } from '../../setting';

// 🌟 将核心逻辑抽离，供 init 命令和 configStore 共同复用
export async function coreInitLogic() {
    await fs.mkdir(CLI_DIR, { recursive: true });
    await fs.mkdir(SESSIONS_DIR, { recursive: true });

    const configPath = path.join(CLI_DIR, 'config.json');
    let isCreated = false;

    const defaultState = {
        models: defaultModels.map(m => ({
            provider: m.provider,
            model: m.name
        })),
        currentModel: defaultModels[0]?.name || ''
    };

    try {
        // 尝试读取现有配置
        const content = await fs.readFile(configPath, 'utf-8');
        const parsed = JSON.parse(content);

        // 核心修复：检查是否为合法的 Zustand persist 结构，且 models 真的有数据
        if (parsed?.state?.models && parsed.state.models.length > 0) {
            return { isCreated: false, state: parsed.state };
        }

        // 文件存在但数据为空，抛出异常强制重写
        throw new Error('Config missing or empty');
    } catch {
        // 如果文件不存在、格式不正确或配置为空，则写入 Zustand 支持的格式
        const persistData = {
            state: {
                ...defaultState,
                _hasHydrated: true
            },
            version: 0 // Zustand 默认所需的 version 字段
        };
        await fs.writeFile(configPath, JSON.stringify(persistData, null, 2), 'utf-8');
        isCreated = true;
    }

    return { isCreated, state: defaultState };
}

export async function runInit(context: CommandContext) {
    console.info('---');
    try {
        // 🌟 命令执行时直接调用核心逻辑
        const { isCreated } = await coreInitLogic();

        await context.addMessage({
            id: crypto.randomUUID(),
            role: 'system',
            content: `✅ [初始化成功]\n- 工作目录: ${CLI_DIR}\n- 会话目录: ${SESSIONS_DIR}\n- 配置文件: ${isCreated ? '已写入默认配置并修复' : '文件已存在且配置有效，跳过覆盖'}`
        });

    } catch (error: any) {
        await context.addMessage({
            id: crypto.randomUUID(),
            role: 'system',
            content: `❌ [初始化失败]: ${error.message}`
        });
    }
}