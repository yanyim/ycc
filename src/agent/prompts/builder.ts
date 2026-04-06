// src/agent/prompts/builder.ts
import type { AgentDefinition } from '../config/agents';
import { getToolInstructions } from './sections/tools';
import { getCodeStyleRules, getAntiHallucinationRules } from './sections/rules';
import { getDynamicEnvContext } from './sections/dynamic';

export const PROMPT_DYNAMIC_BOUNDARY = "\n\n=== DYNAMIC CONTEXT BOUNDARY ===\n\n";

export async function buildSystemPrompt(
    agentDef: AgentDefinition,
    allowedToolNames: string[],
    workspacePath: string // 🌟 新增参数：依赖注入
): Promise<string> {

    // ========================================================================
    // 🧱 【静态段】(Static Sections): 追求 100% 缓存命中率
    // ========================================================================
    const staticSections: string[] = [];

    staticSections.push(agentDef.identityPrompt);

    staticSections.push(`[SYSTEM CONSTRAINTS]
You are operating as an AI agent within a secure CLI environment. 
Please follow all guidelines strictly. Do not hallucinate or guess paths.`);

    if (agentDef.enableCodeStyleRules) {
        staticSections.push(getCodeStyleRules());
    }
    if (agentDef.enableAntiHallucinationRules) {
        staticSections.push(getAntiHallucinationRules());
    }
    if (allowedToolNames.length > 0) {
        staticSections.push(getToolInstructions(allowedToolNames));
    }

    let finalPrompt = staticSections.join('\n\n') + PROMPT_DYNAMIC_BOUNDARY;

    // ========================================================================
    // 🌊 【动态段】(Dynamic Sections)
    // ========================================================================
    const dynamicSections: string[] = [];

    if (agentDef.injectWorkspaceContext) {
        // 🌟 传入统一的 workspacePath
        const envContext = await getDynamicEnvContext(workspacePath);
        dynamicSections.push(envContext);
    }

    finalPrompt += dynamicSections.join('\n\n');
    return finalPrompt;
}