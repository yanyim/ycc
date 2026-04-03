import type { Command } from '../../types/command';

const exitCommand: Command = {
    name: 'exit',
    aliases: ['q', 'quit'],
    description: '退出系统',
    type: 'local',
    execute: async (context) => {
        const { runExit } = await import('./exitImpl');
        return runExit(context);
    }
};

export default exitCommand;
