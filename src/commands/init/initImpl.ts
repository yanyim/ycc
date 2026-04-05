// src/commands/init/initImpl.ts
import { promises as fs } from 'fs';
import { CLI_DIR, SESSIONS_DIR } from '../../storage/storage';
import type { CommandContext } from '../../types/command';
import { models as defaultModels } from '../../setting';

export async function coreInitLogic() {
    // 1. 纯物理目录创建 (Zustand 不管目录，我们在这里建好)
    await fs.mkdir(CLI_DIR, { recursive: true });
    await fs.mkdir(SESSIONS_DIR, { recursive: true });

    // 2. 组装默认数据
    const defaultState = {
        models: defaultModels.map(m => ({
            provider: m.provider,
            model: m.name
        })),
        currentModel: defaultModels[0]?.name || ''
    };

    return { state: defaultState };
}

export async function runInit(context: CommandContext) {
    try {
        const { state } = await coreInitLogic();

        // 🌟 核心理念：直接操作内存状态，Zustand 会自动去排队写盘！
        context.setModels(state.models);
        context.setCurrentModel(state.currentModel);

        await context.addMessage({
            id: crypto.randomUUID(),
            role: 'system',
            content: `✅ [初始化成功]\n- 工作目录: ${CLI_DIR}\n- 会话目录: ${SESSIONS_DIR}\n- 配置已重置为默认\n- 当前模型: ${state.currentModel}`
        });

    } catch (error: any) {
        await context.addMessage({
            id: crypto.randomUUID(),
            role: 'system',
            content: `❌ [初始化失败]: ${error.message}`
        });
    }
}