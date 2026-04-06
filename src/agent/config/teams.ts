// src/agent/config/teams.ts
import type { AgentDefinition } from './agents';
import { EXPLORE_AGENT, CODER_AGENT, VERIFIER_AGENT } from './agents';
import { getSupervisorSystemPrompt } from '../prompts/supervisor';

export interface TeamDefinition {
    id: string;               // 团队的唯一标识符，用于 CLI 命令切换 (例如: /agent coding)
    name: string;             // 团队的显示名称
    description: string;      // 团队的职责描述
    supervisorPrompt: string; // 🌟 依赖注入：这个团队的“大老板”的管理策略
    members: AgentDefinition[]; // 🌟 依赖注入：这个团队拥有的“打工人”列表
}

// ==========================================
// 🚀 实例化：核心研发团队 (Coding Team)
// ==========================================
export const CODING_TEAM: TeamDefinition = {
    id: 'coding',
    name: '核心研发团队',
    description: '标准的软件开发流水线，包含需求探索、代码编写与严格的验收测试。',
    // 注入我们之前写好的研发老板的 Prompt
    supervisorPrompt: getSupervisorSystemPrompt(),
    // 注入这个团队专属的 3 个打工人
    members: [EXPLORE_AGENT, CODER_AGENT, VERIFIER_AGENT]
};

// ==========================================
// 🧪 实例化：(预留) 实验性团队 (Lab Team)
// ==========================================
/*
export const LAB_TEAM: TeamDefinition = {
    id: 'lab',
    name: '实验性实验室',
    description: '用于测试新开发的智能体或高危工具。',
    // 实验团队可以有不同的大老板指令
    supervisorPrompt: `You are the Supervisor of an experimental AI lab...`,
    members: [COLLEAGUE_ZHANG_AGENT, DOC_READER_AGENT] // 假设这是你正在开发的员工
};
*/

// ==========================================
// 📦 全局团队注册表
// ==========================================
export const TEAM_REGISTRY = new Map<string, TeamDefinition>([
    [CODING_TEAM.id, CODING_TEAM],
    // ['lab', LAB_TEAM]
]);

// 默认启动团队
export const DEFAULT_TEAM = CODING_TEAM;