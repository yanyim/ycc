import type { Command } from '../../types/command';

const initCommand: Command = {
    name: 'init',
    aliases: ['i'],
    description: '初始化工作目录与系统配置',
    type: 'local',
    execute: async (context) => {
        // 动态导入，避免影响 CLI 启动速度
        const { runInit } = await import('./initImpl');
        return runInit(context);
    }
};

export default initCommand;