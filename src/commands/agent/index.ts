// src/commands/agent/index.ts
import type { Command } from '../../types/command';
import { runAgent } from './agentImpl';

const agentCommand: Command = {
    name: 'agent',
    description: '切换当前执行任务的多智能体团队 (如: /agent coding)',
    type: 'local',
    execute: runAgent
};

export default agentCommand;