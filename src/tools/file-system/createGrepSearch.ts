import { tool } from "@langchain/core/tools";
import { z } from "zod";
import fg from "fast-glob";
import { resolve } from "path";
import { validateAndResolvePath } from "./utils";

export function createGrepSearchTool(projectRoot: string) {
    return tool(
        async ({ query, directory = ".", includePattern = "**/*.{ts,tsx,js,jsx,json,md,yml,yaml}" }) => {
            try {
                const targetDir = validateAndResolvePath(projectRoot, directory);

                // 限定搜索范围，避免扫描非文本文件
                const files = await fg(includePattern, {
                    cwd: targetDir,
                    onlyFiles: true,
                    ignore: ["**/node_modules/**", "**/.git/**", "dist/**", "build/**"]
                });

                const regex = new RegExp(query, "i");
                let results: string[] = [];
                let totalMatches = 0;

                for (const relativeFilePath of files) {
                    const text = await Bun.file(resolve(targetDir, relativeFilePath)).text();
                    const lines = text.split("\n");

                    for (let index = 0; index < lines.length; index++) {
                        const line = lines[index];

                        // 类型守卫：告诉 TS 这个 line 绝对是 string，不是 undefined
                        if (line === undefined) continue;

                        if (regex.test(line)) {
                            totalMatches++;
                            // 命中上限，提前熔断，防止打爆大模型上下文
                            if (results.length >= 30) continue;

                            const start = Math.max(0, index - 1);
                            const end = Math.min(lines.length, index + 2);

                            const context = lines.slice(start, end)
                                .map((l, i) => `${relativeFilePath}:${start + i + 1}: ${l}`)
                                .join("\n");

                            results.push(context);
                        }
                    }
                }

                if (totalMatches === 0) return "No matches found.";

                let output = results.join("\n---\n");
                if (totalMatches > 30) {
                    output += `\n\n... and ${totalMatches - 30} more matches. Try making your query more specific.`;
                }
                return output;
            } catch (error: any) {
                return `Search error: ${error.message}`;
            }
        },
        {
            name: "grep_search",
            description: "Search for keywords or regex in text files. Returns matching lines with context.",
            schema: z.object({
                query: z.string().describe("Search keyword or regex (case-insensitive)"),
                directory: z.string().optional().describe("Directory to search in"),
                includePattern: z.string().optional().describe("Glob pattern for file types"),
            }),
        }
    );
}