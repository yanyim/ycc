import {tool} from "@langchain/core/tools";
import {z} from "zod";
import {validateAndResolvePath} from "./utils";
import {createReadFileTool} from "./createReadFile";
import {resolve} from "path";

export function createAnalyzeFileTool(projectRoot: string) {
    // 内部可以复用其他工具
    const fallbackReadTool = createReadFileTool(projectRoot);

    return tool(
        async ({filePath}) => {
            try {
                validateAndResolvePath(projectRoot, filePath); // 确保不越权

                const ext = filePath.substring(filePath.lastIndexOf(".")).toLowerCase();

                // 策略分发：未来可以在这里拓展 Tree-sitter 等逻辑
                if ([".ts", ".tsx", ".js", ".jsx"].includes(ext)) {
                    // TODO: Phase 3 - 集成 web-tree-sitter 提取 AST 骨架
                    return `[AST Analyzer Triggered for ${ext}]: This feature is under construction. Falling back to reading top 50 lines...\n\n` +
                        await fallbackReadTool.invoke({filePath, limit: 50});
                }

                if (ext === ".json") {
                    // 针对 JSON 可以做特殊的 Key-Value 提取或 Schema 总结
                    const content = await Bun.file(resolve(projectRoot, filePath)).text();
                    const parsed = JSON.parse(content);
                    return `JSON Structure Summary:\nRoot Keys: ${Object.keys(parsed).join(", ")}`;
                }

                // 默认回退策略
                return await fallbackReadTool.invoke({filePath, limit: 50});
            } catch (error: any) {
                return `Analysis error: ${error.message}`;
            }
        },
        {
            name: "analyze_file",
            description: "Intelligently analyze a file based on its extension (e.g., AST skeleton for code).",
            schema: z.object({
                filePath: z.string().describe("Relative path to the file"),
            }),
        }
    );
}