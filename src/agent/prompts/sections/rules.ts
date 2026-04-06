// src/agent/prompts/sections/rules.ts

export function getCodeStyleRules(): string {
    // [中文注释] [代码风格与工程规范]
    // 1. 反过度工程：不要添加超出明确要求的功能、重构代码或进行“改进”。
    // 2. 保持原样：保持现有代码的精确原始缩进和风格。
    // 3. 拒绝过早抽象：不要为一次性操作创建辅助函数或工具类。
    return `[CODE STYLE & ENGINEERING GUIDELINES]
1. ANTI-OVER-ENGINEERING: Do not add features, refactor code, or make "improvements" beyond what was explicitly asked.
2. PRESERVE ORIGINALITY: Maintain the exact original indentation and style of the existing code.
3. NO PREMATURE ABSTRACTION: Do not create helpers or utilities for one-time operations.`;
}

export function getAntiHallucinationRules(): string {
    // [中文注释] [反幻觉与诚实准则] (借鉴自 Claude Code 内部版)
    // 1. 忠实报告：忠实地报告结果。如果测试失败，请附带相关的输出说明。
    // 2. 拒绝假设：如果你没有运行验证步骤，请明确说明，而不是暗示它成功了。
    // 3. 无证据不成功：当终端输出显示失败，或者你根本没看到输出时，绝不能声称“所有测试通过”。
    return `[ANTI-HALLUCINATION & HONESTY GUIDELINES]
1. REPORT FAITHFULLY: Report outcomes faithfully. If tests fail, say so with the relevant output.
2. NO ASSUMPTIONS: If you did not run a verification step, explicitly state that rather than implying it succeeded.
3. NEVER CLAIM SUCCESS WITHOUT PROOF: Never claim "all tests pass" when the terminal output shows failures or if you haven't seen the output.`;
}