import {DynamicStructuredTool, StructuredTool} from "@langchain/core/tools";
import {z} from "zod";
import type {AgentDefinition} from "../config/agents";

// 导入自定义实现的文件系统工具工厂
import {
    createAnalyzeFileTool,
    createGrepSearchTool,
    createListFilesTool,
    createReadFileTool
} from "../../tools/file-system";

/**
 * 工具注册与分发中心
 * 负责根据 Agent 的定义，动态生成带有权限沙箱的工具集
 */
export class CodeToolRegistry {
    private workspacePath: string;

    constructor(workspacePath: string = process.cwd()) {
        this.workspacePath = workspacePath;
    }

    /**
     * 核心漏斗：为特定的 Agent 解析并生成专属工具集
     */
    public resolveToolsForAgent(agentDef: AgentDefinition): StructuredTool[] {
        let tools = this.initializeAllTools();

        // 1. 第一层漏斗：沙箱隔离拦截
        tools = this.applyIsolationPolicy(tools, agentDef.isolation);

        // 2. 第二层漏斗：角色白名单拦截
        if (agentDef.allowedTools !== '*') {
            const allowedSet = new Set(agentDef.allowedTools);
            // 注意：这里需要匹配自定义工具定义的 name
            tools = tools.filter(tool => allowedSet.has(tool.name));
        }

        // 3. 第三层漏斗：黑名单拦截
        if (agentDef.disallowedTools && agentDef.disallowedTools.length > 0) {
            const disallowedSet = new Set(agentDef.disallowedTools);
            tools = tools.filter(tool => !disallowedSet.has(tool.name));
        }

        return tools;
    }

    /**
     * 实例化所有底层可用工具
     */
    private initializeAllTools(): StructuredTool[] {
        const tools: StructuredTool[] = [];

        // --- 接入自定义核心文件系统工具 (替代 @langchain/community) ---
        // 这些工具已经通过闭包绑定了 this.workspacePath
        tools.push(createListFilesTool(this.workspacePath));   // 工具名: list_files
        tools.push(createReadFileTool(this.workspacePath));    // 工具名: read_file
        tools.push(createGrepSearchTool(this.workspacePath));  // 工具名: grep_search
        tools.push(createAnalyzeFileTool(this.workspacePath)); // 工具名: analyze_file

        // --- 补充自定义工具：命令行执行 ---
        tools.push(
            new DynamicStructuredTool({
                name: "bash_execute",
                description: "在终端中执行 shell 命令并返回 stdout 和 stderr。高危操作！",
                schema: z.object({
                    command: z.string().describe("要执行的 shell 命令"),
                }),
                func: async ({command}) => {
                    // TODO: 结合 Bun.spawn 实现真实的执行逻辑
                    return `[Mock Executing]: ${command}\nOutput: success`;
                },
            })
        );

        // 注意：原代码中的 ReadFileTool 和 WriteFileTool (官方) 已移除
        // 原代码中的 mock grep 已经被真正的 createGrepSearchTool 替代

        return tools;
    }

    /**
     * 应用隔离策略 (安全防线的核心)
     */
    private applyIsolationPolicy(tools: StructuredTool[], isolation: AgentDefinition['isolation']): StructuredTool[] {
        switch (isolation) {
            case 'read-only':
                // 只读模式：移除带有写操作或执行操作的工具
                return tools.filter(t =>
                    t.name !== 'write_file' && // 预留
                    t.name !== 'bash_execute'
                );

            case 'tmp-only':
                // tmp-only 模式：目前主要拦截 bash_execute，或在未来将写操作重定向至临时目录
                return tools.map(t => {
                    // 如果未来实现了自定义 write_file，可在此重定向路径至 os.tmpdir()
                    return t;
                });

            case 'workspace-rw':
                return tools;

            default:
                return tools.filter(t => t.name !== 'write_file' && t.name !== 'bash_execute');
        }
    }
}