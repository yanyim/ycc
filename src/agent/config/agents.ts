// src/agent/config/agents.ts
import type { AgentRole, ModelTier, IsolationMode } from '../types/events';

export interface AgentDefinition {
    name: string;
    role: AgentRole;
    description: string;
    modelTier: ModelTier;
    isolation: IsolationMode;
    systemPrompt: string;
    criticalReminder?: string;
    allowedTools?: string[] | '*';
    disallowedTools?: string[];
    omitHeavyContext?: boolean;
}

export const EXPLORE_AGENT: AgentDefinition = {
    name: 'ExploreAgent',
    role: 'explorer',
    description: '快速探索项目代码库，搜索文件、查找引用，不进行任何修改操作。',
    modelTier: 'fast', // 使用便宜、快速的模型 (如 Haiku, Flash, 或本地模型)
    isolation: 'read-only',
    allowedTools: ['read_file', 'grep', 'glob', 'list_files','grep_search'],
    omitHeavyContext: true, // 核心：不带冗长的历史代码，只带搜索任务
    systemPrompt: `你是一个极致高效的代码探索专家。
=== CRITICAL: READ-ONLY MODE ===
你被绝对禁止修改任何文件。你的唯一任务是使用搜索工具找到目标代码，并提取核心逻辑。
请尽可能并行调用工具以提升速度。`,
};

export const CODER_AGENT: AgentDefinition = {
    name: 'CoderAgent',
    role: 'coder',
    description: '负责分析需求并实际编写、重构或修改代码文件。',
    modelTier: 'reasoning', // 需要强大的推理模型 (如 Sonnet 3.5, GPT-4o)
    isolation: 'workspace-rw', // 具备读写权限
    allowedTools: '*', // 拥有所有可用工具
    systemPrompt: `你是一名高级全栈研发工程师。
在修改代码前，请确保你已经充分理解了上下文。如果需要，你可以主动调用工具查看相关依赖。
所有的危险操作（如覆盖核心文件）系统会自动挂起并请求人类确认。`,
};

export const VERIFIER_AGENT: AgentDefinition = {
    name: 'VerifierAgent',
    role: 'verifier',
    description: '对抗性测试专家，负责验证 Coder 修改的代码是否真实有效。',
    modelTier: 'inherit',
    isolation: 'tmp-only', // 只能在 /tmp 写脚本，不能改源码
    allowedTools: ['read_file', 'bash_execute', 'write_tmp_file'],
    systemPrompt: `你是一个挑剔的验证专家。你的目标是尽全力找出代码里的漏洞，而不是盲目确认通过。
=== 警惕逃避心理 ===
不要阅读代码后就回复“看起来没问题”。你必须写一个测试脚本并运行它！
必须以 VERDICT: PASS / FAIL / PARTIAL 结尾。`,
    criticalReminder: 'CRITICAL: 这是纯验证任务。严禁修改项目源码。必须执行真实的测试命令。'
};

export const AGENT_REGISTRY = [EXPLORE_AGENT, CODER_AGENT, VERIFIER_AGENT];