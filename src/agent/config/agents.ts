// src/agent/config/agents.ts
import type { AgentRole, IsolationMode, ModelTier } from '../types/events';

// 🌟 引入纯净的提示词字典
import {
    EXPLORE_IDENTITY,
    CODER_IDENTITY,
    VERIFIER_IDENTITY,
    VERIFIER_CRITICAL_REMINDER
} from '../prompts/identities';

export interface AgentDefinition {
    name: string;
    role: AgentRole;
    description: string;
    modelTier: ModelTier;
    isolation: IsolationMode;
    identityPrompt: string;
    enableCodeStyleRules?: boolean;
    enableAntiHallucinationRules?: boolean;
    injectWorkspaceContext?: boolean;
    criticalReminder?: string;
    allowedTools?: string[] | '*';
    disallowedTools?: string[];
    omitHeavyContext?: boolean;
}

export const EXPLORE_AGENT: AgentDefinition = {
    name: 'ExploreAgent',
    role: 'explorer',
    description: '快速探索项目代码库，搜索文件、查找引用，不进行任何修改操作。',
    modelTier: 'fast',
    isolation: 'read-only',
    allowedTools: ['read_file', 'grep', 'glob', 'list_files', 'grep_search'],
    omitHeavyContext: true,

    identityPrompt: EXPLORE_IDENTITY, // 🌟 极其清爽的引用

    enableCodeStyleRules: false,
    enableAntiHallucinationRules: true,
    injectWorkspaceContext: true,
};

export const CODER_AGENT: AgentDefinition = {
    name: 'CoderAgent',
    role: 'coder',
    description: '负责分析需求并实际编写、重构或修改代码文件。',
    modelTier: 'reasoning',
    isolation: 'workspace-rw',
    allowedTools: '*',

    identityPrompt: CODER_IDENTITY, // 🌟

    enableCodeStyleRules: true,
    enableAntiHallucinationRules: false,
    injectWorkspaceContext: true,
};

export const VERIFIER_AGENT: AgentDefinition = {
    name: 'VerifierAgent',
    role: 'verifier',
    description: '对抗性测试专家，负责验证 Coder 修改的代码是否真实有效。',
    modelTier: 'inherit',
    isolation: 'tmp-only',
    allowedTools: ["list_files", "read_file", "run_linter", 'bash_execute', 'write_tmp_file'],

    identityPrompt: VERIFIER_IDENTITY, // 🌟
    criticalReminder: VERIFIER_CRITICAL_REMINDER, // 🌟

    enableCodeStyleRules: false,
    enableAntiHallucinationRules: true,
    injectWorkspaceContext: true,
};

export const AGENT_REGISTRY = [EXPLORE_AGENT, CODER_AGENT, VERIFIER_AGENT];