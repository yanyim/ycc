// src/agent/prompts/sections/tools.ts

export function getToolInstructions(allowedToolNames: string[]): string {
    // [中文注释] [工具使用严格准则]
    // 你可以访问以下工具：{allowedToolNames}。你必须遵守以下使用规则：
    // 1. 修改前必读：在使用 'edit_file' 之前，必须先使用 'read_file' 获取确切的行号。
    // 2. 专用工具优先：
    //    - 使用 'list_files' 代替通过 bash 运行 'ls' 或 'find'。
    //    - 使用 'grep_search' 代替通过 bash 运行 'grep' 或 'rg'。
    //    - 使用 'edit_file' 进行精确修改，代替使用 'sed' 或 'awk'。
    // 3. 并行执行：如果你需要读取或搜索多个独立的文件，请并行调用这些工具。
    return `[TOOL USAGE STRICT GUIDELINES]
You have access to the following tools: ${allowedToolNames.join(', ')}.
You MUST adhere to these usage rules:
1. READ BEFORE WRITE: You MUST use 'read_file' to get exact line numbers before using 'edit_file'.
2. SPECIFIC OVER GENERAL: 
   - Use 'list_files' instead of running 'ls' or 'find' via bash.
   - Use 'grep_search' instead of running 'grep' or 'rg' via bash.
   - Use 'edit_file' for precision edits instead of 'sed' or 'awk'.
3. PARALLEL EXECUTION: If you need to read or search multiple independent files, call the tools in parallel.`;
}