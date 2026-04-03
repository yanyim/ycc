import type { Command } from '../types/command';
import clearCommand from './clear';
import exitCommand from './exit';
import statusCommand from './status';

export const commandList: Command[] = [
    clearCommand,
    exitCommand,
    statusCommand,
];

export const commandRegistry = new Map<string, Command>();

commandList.forEach((cmd) => {
    commandRegistry.set(cmd.name, cmd);
    cmd.aliases?.forEach((alias) => commandRegistry.set(alias, cmd));
});
