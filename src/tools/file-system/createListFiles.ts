// src/tools/file-system/createListFiles.ts
import { DynamicStructuredTool } from "@langchain/core/tools";
import { z } from "zod";
import fg from "fast-glob";
import { existsSync, readFileSync } from "fs";
import path from "path";
import { validateAndResolvePath } from "./utils";

export const listFilesSchema = z.object({
    directory: z.string().optional().default(".").describe(
        "The relative directory path to explore. Defaults to '.'. \n" +
        "Examples: 'docs', 'src/components', or '.' for the project root."
    ),
    pattern: z.string().optional().default("**/*").describe(
        "Glob pattern to filter files. Defaults to '**/*'. \n" +
        "Examples: '**/*.ts' for TypeScript files, 'src/**/*.md' for markdown files inside src."
    )
});

export const listFilesDescription =
    "Retrieves the directory tree structure. Useful for exploring the codebase, finding specific files, or understanding project architecture.";

export const createListFilesTool = (workspacePath: string) => {
    return new DynamicStructuredTool({
        name: "list_files",
        description: listFilesDescription,
        schema: listFilesSchema,
        func: async ({ directory, pattern }) => {
            try {
                const safeDirPath = validateAndResolvePath(workspacePath, directory);

                // 🌟 核心修复 1：动态解析 .gitignore
                const ignorePatterns = ['**/node_modules/**', '**/.git/**'];
                const gitignorePath = path.join(workspacePath, '.gitignore');

                if (existsSync(gitignorePath)) {
                    const gitignoreContent = readFileSync(gitignorePath, 'utf-8');
                    const customIgnores = gitignoreContent
                        .split('\n')
                        .map(line => line.trim())
                        .filter(line => line && !line.startsWith('#'))
                        .map(line => {
                            // 简单的 gitignore 转 glob 规则
                            let globPattern = line;
                            if (globPattern.startsWith('/')) globPattern = globPattern.slice(1);
                            if (globPattern.endsWith('/')) globPattern = globPattern.slice(0, -1);
                            return `**/${globPattern}/**`;
                        });
                    ignorePatterns.push(...customIgnores);
                }

                const entries = await fg(pattern, {
                    cwd: safeDirPath,
                    onlyFiles: true,
                    dot: true,
                    ignore: ignorePatterns // 应用整合后的忽略列表
                });

                if (entries.length === 0) {
                    return `No files found matching pattern '${pattern}' in directory '${directory}'.`;
                }

                const maxFiles = 100;
                let result = entries.slice(0, maxFiles).join('\n');

                if (entries.length > maxFiles) {
                    result += `\n\n... (And ${entries.length - maxFiles} more files. Please use a more specific directory or pattern to narrow down the search.)`;
                }

                return `Found ${entries.length} files:\n${result}`;
            } catch (error: any) {
                return `Error listing files: ${error.message}`;
            }
        }
    });
};