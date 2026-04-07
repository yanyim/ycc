// src/agent/config/teams.ts
import type { CodeToolRegistry } from '../tools/registry';

// 1. 导入物理隔离的各个特种团队
import { BATCH_REFACTOR_TEAM } from '../teams/batch-edit';
import { CODING_TEAM } from '../teams/coding';

// 2. 极其干净的接口：强制要求提供图的编译能力
export interface TeamDefinition {
    id: string;
    name: string;
    description: string;

    // 🌟 彻底废弃 supervisorPrompt 和 members
    // 强制要求：团队必须自己决定如何构建自己的 Graph
    buildTeamGraph: (
        llmModel: any,
        toolRegistry: CodeToolRegistry,
        workspacePath: string,
        delayMs: number
    ) => any;
}

// 3. 全局团队注册表
export const TEAM_REGISTRY = new Map<string, TeamDefinition>([
    [CODING_TEAM.id, CODING_TEAM],
    [BATCH_REFACTOR_TEAM.id, BATCH_REFACTOR_TEAM]
]);

// 默认启动团队
export const DEFAULT_TEAM = CODING_TEAM;