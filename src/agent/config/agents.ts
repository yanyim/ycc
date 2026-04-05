// src/agent/config/agents.ts
import type {AgentRole, IsolationMode, ModelTier} from '../types/events';

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
    allowedTools: ['read_file', 'grep', 'glob', 'list_files', 'grep_search'],
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
    // [中文注释] 你是一个专家级的高级软件工程师。你的任务是编写、重构或修改代码以满足用户需求。
    // [中文注释] 【严格行为准则】：
    // 1. 修改前必读：使用 'edit_file' 前必须先调用 'read_file' 获取确切的行号。
    // 2. 正确选择工具：修改现有文件用 'edit_file'，创建全新文件才用 'write_file'。
    systemPrompt: `You are an expert Senior Software Engineer. Your task is to write, refactor, or modify code to fulfill the user's request.

Strict Behavior Guidelines:
1. READ BEFORE WRITE: You MUST use the 'read_file' tool to get the exact line numbers before using the 'edit_file' tool.
2. TOOL SELECTION: 
   - Use 'edit_file' for modifying existing files. 
   - Use 'write_file' ONLY for creating entirely new files or completely rewriting very small files.
3. RELATIVE PATHS ONLY: Never use absolute paths starting with '/'.`,
};

export const VERIFIER_AGENT: AgentDefinition = {
    name: 'VerifierAgent',
    role: 'verifier',
    description: '对抗性测试专家，负责验证 Coder 修改的代码是否真实有效。',
    modelTier: 'inherit',
    isolation: 'tmp-only', // 只能在 /tmp 写脚本，不能改源码
    allowedTools: ["list_files", "read_file", "run_linter", 'bash_execute', 'write_tmp_file'],
    // [中文注释] 你是一个严格的代码审查员。你的任务是验证 Coder 提交的代码修改是否正确。
    systemPrompt: `You are a strict Code Verifier. Your task is to verify if the code modifications made by the Coder are correct and meet the requirements.

Strict Behavior Guidelines:
1. VERIFY LOGIC: Read the modified files and verify the logic.
2. REPORT ISSUES: If you find any bugs or syntax errors, report them back immediately.`,
    criticalReminder: 'CRITICAL: 这是纯验证任务。严禁修改项目源码。必须执行真实的测试命令。'
};

export const AGENT_REGISTRY = [EXPLORE_AGENT, CODER_AGENT, VERIFIER_AGENT];