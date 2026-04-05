// src/tools/file-system/createWriteFile.ts
import { DynamicStructuredTool } from "@langchain/core/tools";
import { z } from "zod";
import path from "path";
import { promises as fs } from "fs";
import { validateAndResolvePath } from "./utils";

// [中文注释] write_file 结构定义与纯英文提示词
export const writeFileSchema = z.object({
    filePath: z.string().describe(
        "The relative path of the target file. Directories will be created automatically if they do not exist."
    ),
    content: z.string().describe(
        "The COMPLETE and FULL content to write. \n" +
        "CRITICAL WARNING: This tool will COMPLETELY OVERWRITE the existing file. \n" +
        "DO NOT use this tool to modify small parts of an existing large file, as you might accidentally delete unmentioned code. \n" +
        "If you need to change existing code, use the 'edit_file' tool instead."
    )
});

export const writeFileDescription =
    "Creates a new file or completely overwrites an existing one. Use this ONLY for new files or when a complete rewrite is explicitly necessary.";

export const createWriteFileTool = (workspacePath: string) => {
    return new DynamicStructuredTool({
        name: "write_file",
        description: writeFileDescription,
        schema: writeFileSchema,
        func: async ({ filePath, content }) => {
            try {
                // 1. 安全解析物理路径
                const safeFilePath = validateAndResolvePath(workspacePath, filePath);

                // 2. 提取目标文件所在的目录
                const dirPath = path.dirname(safeFilePath);

                // 3. 递归创建父级目录 (如果存在则无事发生)
                await fs.mkdir(dirPath, { recursive: true });

                // 4. 拥抱 Bun: 原生极速写入
                await Bun.write(safeFilePath, content);

                return `Successfully wrote to file '${filePath}'.`;
            } catch (error: any) {
                return `Error writing file: ${error.message}`;
            }
        }
    });
};