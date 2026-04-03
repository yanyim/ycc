import type { Command } from '../../types/command';

const statusCommand: Command = {
    name: 'status',
    aliases: ['s'],
    description: '查看状态',
    type: 'local',
    execute: async (context) => {
        const { runStatus } = await import('./statusImpl');
        return runStatus(context);
    }
};

export default statusCommand;
