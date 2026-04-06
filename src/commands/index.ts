import type {Command} from '../types/command';
import clearCommand from './clear';
import exitCommand from './exit';
import statusCommand from './status';
import initCommand from './init'; // 🌟 新增引入
import modelsCommand from './models'; // 🌟 引入模型选择命令
import agentCommand from './agent'; // 🌟 引入模型选择命令

export const commandList: Command[] = [
    clearCommand,
    exitCommand,
    statusCommand,
    initCommand, // 🌟 注册命令
    modelsCommand, // 🌟 注册模型选择命令
    agentCommand,
];

export const commandRegistry = new Map<string, Command>();

commandList.forEach((cmd) => {
    commandRegistry.set(cmd.name, cmd);
    cmd.aliases?.forEach((alias) => commandRegistry.set(alias, cmd));
});