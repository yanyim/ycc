import { StructuredTool, DynamicStructuredTool } from "@langchain/core/tools";
// 注意：不同版本的 langchain 导出路径可能略有不同，请根据你的 @langchain/community 实际路径调整
import { ReadFileTool, WriteFileTool } from "@langchain/community/tools";
import { z } from "zod";
import * as path from "path";
import * as os from "os";
import { AgentDefinition } from "../config/agents";

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
        // 1. 初始化全量底层工具库
        let tools = this.initializeAllTools();

        // 2. 第一层漏斗：沙箱隔离拦截 (Isolation Interceptor)
        tools = this.applyIsolationPolicy(tools, agentDef.isolation);

        // 3. 第二层漏斗：角色白名单拦截 (Allowed Tools)
        if (agentDef.allowedTools !== '*') {
            const allowedSet = new Set(agentDef.allowedTools);
            tools = tools.filter(tool => allowedSet.has(tool.name));
        }

        // 4. 第三层漏斗：黑名单拦截 (Disallowed Tools)
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

        // --- 引入官方 File System 工具 ---
        // 默认将其读写范围限制在当前工作区，防止跨目录越权读取 (如 /etc/shadow)
        tools.push(new ReadFileTool({ rootDirectory: this.workspacePath }));
        tools.push(new WriteFileTool({ rootDirectory: this.workspacePath }));

        // --- 补充自定义工具：命令行执行 ---
        tools.push(
            new DynamicStructuredTool({
                name: "bash_execute",
                description: "在终端中执行 shell 命令并返回 stdout 和 stderr。高危操作！",
                schema: z.object({
                    command: z.string().describe("要执行的 shell 命令"),
                }),
                func: async ({ command }) => {
                    // TODO: 实际的 exec 或 spawn 逻辑实现
                    // 在 CLI 中，这里后续会结合 React Ink 抛出事件
                    return `[Mock Executing]: ${command}\nOutput: success`;
                },
            })
        );

        // --- 补充自定义工具：代码库全局检索 ---
        tools.push(
            new DynamicStructuredTool({
                name: "grep",
                description: "在代码库中基于正则表达式搜索字符串",
                schema: z.object({
                    pattern: z.string().describe("搜索的正则表达式"),
                    dir: z.string().optional().describe("指定搜索子目录，默认为当前目录"),
                }),
                func: async ({ pattern, dir }) => {
                    // TODO: 实际的 ripgrep 或 node 遍历搜索逻辑
                    return `[Mock Grep]: 找到了关于 ${pattern} 的 3 处引用...`;
                },
            })
        );

        return tools;
    }

    /**
     * 应用隔离策略 (安全防线的核心)
     */
    private applyIsolationPolicy(tools: StructuredTool[], isolation: AgentDefinition['isolation']): StructuredTool[] {
        switch (isolation) {
            case 'read-only':
                // 只读模式：直接在数组中剔除所有带有破坏性的工具
                return tools.filter(t =>
                    t.name !== 'write_file' &&
                    t.name !== 'bash_execute'
                );

            case 'tmp-only':
                // tmp-only 模式 (主要供 Verifier 使用)：
                // 允许写文件，但必须强制修改其底层配置，将其 Root Dir 指向操作系统的 /tmp 目录
                return tools.map(t => {
                    if (t.name === 'write_file') {
                        // 返回一个指向 /tmp 的新 WriteFileTool 实例，覆盖原有的 workspace 配置
                        return new WriteFileTool({ rootDirectory: os.tmpdir() });
                    }
                    if (t.name === 'bash_execute') {
                        // 这里的拦截逻辑可以更细致，比如限制 Bash 只能运行带 `test` 的命令
                        return t;
                    }
                    return t;
                });

            case 'workspace-rw':
                // 拥有完整权限，不做任何拦截
                return tools;

            default:
                // 默认 fallback 为最安全的只读模式
                return tools.filter(t => t.name !== 'write_file' && t.name !== 'bash_execute');
        }
    }
}