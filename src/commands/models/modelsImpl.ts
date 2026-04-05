// src/commands/models/modelsImpl.ts
import type { CommandContext } from '../../types/command';

export async function runModels(context: CommandContext) {
    const { args, models, setMode, setAvailableCommands, setCurrentModel, addMessage } = context;

    // 1. 无参数：进入模型选择 UI 模式
    if (args.length === 0) {
        if (!models || models.length === 0) {
            await addMessage({
                id: crypto.randomUUID(),
                role: 'system',
                content: '❌ 模型列表为空，请检查配置文件或运行 /init 重新初始化。'
            });
            return;
        }

        // 转换 models 数组供 UI 的 SelectInput 组件使用
        const modelOptions = models.map(m => ({
            label: `[${m.provider}] ${m.model}`,
            value: m.model
        }));

        setAvailableCommands(modelOptions);
        setMode('model-selection');

        await addMessage({
            id: crypto.randomUUID(),
            role: 'system',
            content: '👇 请使用上下键选择你想切换的模型，或输入内容进行筛选，按 Tab 补全：'
        });
        return;
    }

    // 2. 有参数：执行模型切换逻辑
    const selectedModelName = args[0];
    const targetModel = models.find(m => m.model === selectedModelName);

    if (!targetModel) {
        await addMessage({
            id: crypto.randomUUID(),
            role: 'system',
            content: `❌ 切换失败，未知模型: ${selectedModelName}`
        });
    } else {
        // Zustand 监听到 setCurrentModel 后，会自动触发 persist 将新状态写入硬盘
        setCurrentModel(targetModel.model);
        await addMessage({
            id: crypto.randomUUID(),
            role: 'system',
            content: `✅ [模型切换成功]: 当前模型已变更为 ${targetModel.model}`
        });
    }

    // 无论是成功还是失败，都退出模型选择模式，恢复正常对话输入模式
    setMode('normal');
}