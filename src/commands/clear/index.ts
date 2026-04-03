import type { Command } from '../../types/command';

const clearCommand: Command = {
    name: 'clear',
    aliases: ['c'],
    description: '清空屏幕并重置对话历史',
    type: 'local',
    execute: async (context) => {
        const { runClear } = await import('./clearImpl');
        return runClear(context);
    }
};

export default clearCommand;
