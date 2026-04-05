// src/commands/models/index.ts
import type { Command } from '../../types/command';

const modelsCommand: Command = {
    name: 'models',
    aliases: ['m'],
    description: '切换大模型',
    type: 'local',
    execute: async (context) => {
        const { runModels } = await import('./modelsImpl');
        return runModels(context);
    }
};

export default modelsCommand;