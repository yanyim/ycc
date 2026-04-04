import type { Command } from '../types/command';
import clearCommand from './clear';
import exitCommand from './exit';
import statusCommand from './status';
import initCommand from './init'; // 🌟 新增引入

export const commandList: Command[] = [
    clearCommand,
    exitCommand,
    statusCommand,
    initCommand, // 🌟 注册命令
];

export const commandRegistry = new Map<string, Command>();

commandList.forEach((cmd) => {
    commandRegistry.set(cmd.name, cmd);
    cmd.aliases?.forEach((alias) => commandRegistry.set(alias, cmd));
});