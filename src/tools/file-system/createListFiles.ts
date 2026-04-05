import { tool } from "@langchain/core/tools";
import { z } from "zod";
import fg from "fast-glob";
import ignore from "ignore";
import { resolve } from "path";
import { validateAndResolvePath } from "./utils";

export function createListFilesTool(projectRoot: string) {
    return tool(
        async ({ pattern = "**/*", directory = "." }) => {
            try {
                const targetDir = validateAndResolvePath(projectRoot, directory);

                const ig = ignore();
                const gitignoreFile = Bun.file(resolve(projectRoot, ".gitignore"));
                if (await gitignoreFile.exists()) {
                    ig.add(await gitignoreFile.text());
                }
                ig.add([".git/**", "node_modules/**"]); // 强制底线过滤

                const files = await fg(pattern, {
                    cwd: targetDir,
                    dot: true,
                    onlyFiles: true,
                });

                const filteredFiles = files.filter(file => !ig.ignores(file));

                return filteredFiles.length > 0
                    ? `Found ${filteredFiles.length} files:\n${filteredFiles.join("\n")}`
                    : "No matching files found.";
            } catch (error: any) {
                return `Error listing files: ${error.message}`;
            }
        },
        {
            name: "list_files",
            description: "List files in the directory. Respects .gitignore. Always use relative paths.",
            schema: z.object({
                pattern: z.string().optional().describe("Glob pattern, e.g., '**/*.ts'"),
                directory: z.string().optional().describe("Relative directory to search in"),
            }),
        }
    );
}