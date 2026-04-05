// src/tools/file-system/createEditFile.ts
import { DynamicStructuredTool } from "@langchain/core/tools";
import { z } from "zod";
import { validateAndResolvePath } from "./utils";

// [中文注释] edit_file 结构定义与纯英文提示词 (行号区间替换策略)
export const editFileSchema = z.object({
    filePath: z.string().describe(
        "The relative path of the file to edit."
    ),
    startLine: z.number().int().positive().describe(
        "The starting line number (1-indexed, inclusive) of the code block to replace. \n" +
        "MUST be based on the exact line numbers provided by the 'read_file' tool."
    ),
    endLine: z.number().int().positive().describe(
        "The ending line number (inclusive) of the code block to replace. \n" +
        "If replacing a single line, startLine and endLine should be identical."
    ),
    newContent: z.string().describe(
        "The exact new code snippet that will replace the specified line range. \n" +
        "CRITICAL RULES:\n" +
        "1. Maintain the exact original indentation for the replaced block.\n" +
        "2. To DELETE lines, provide an empty string (\"\").\n" +
        "3. To INSERT code without deleting, you must include the original line(s) in this newContent along with your additions."
    )
});

export const editFileDescription =
    "A precision code editor tool. Replaces a specific block of lines in a file with new content. \n" +
    "PREREQUISITE: You MUST call 'read_file' first to get the exact line numbers before using this tool.";

export const createEditFileTool = (workspacePath: string) => {
    return new DynamicStructuredTool({
        name: "edit_file",
        description: editFileDescription,
        schema: editFileSchema,
        func: async ({ filePath, startLine, endLine, newContent }) => {
            try {
                // 1. 安全校验与文件检查
                const safeFilePath = validateAndResolvePath(workspacePath, filePath);
                const file = Bun.file(safeFilePath);

                if (!(await file.exists())) {
                    return `Error: File not found at '${filePath}'. You must use 'write_file' to create new files.`;
                }

                if (startLine > endLine) {
                    return `Error: startLine (${startLine}) cannot be greater than endLine (${endLine}).`;
                }

                // 2. 读取文件内容并分割成行数组
                const content = await file.text();
                // 统一处理 Windows(\r\n) 和 Linux(\n) 的换行符
                const lines = content.split(/\r?\n/);
                const totalLines = lines.length;

                // 3. 边界熔断防御
                if (startLine > totalLines + 1) {
                    return `Error: startLine (${startLine}) is beyond the end of the file (total lines: ${totalLines}).`;
                }

                // 4. 将 1-indexed (人看) 转换为 0-indexed (程序看)
                const startIndex = startLine - 1;
                // 要被替换掉的行数 (例如替换第2行到第4行，要删掉 4-2+1=3 行)
                const deleteCount = Math.min(endLine - startLine + 1, totalLines - startIndex);

                // 5. 处理将要插入的新内容 (如果是纯删除 ""，则插入空数组)
                const insertLines = newContent === "" ? [] : newContent.split('\n');

                // 6. 🌟 核心：使用 splice 完美替换数组中的片段
                lines.splice(startIndex, deleteCount, ...insertLines);

                // 7. 拼接回字符串并保存
                const updatedContent = lines.join('\n');
                await Bun.write(safeFilePath, updatedContent);

                return `Successfully edited '${filePath}' from line ${startLine} to ${endLine}.`;
            } catch (error: any) {
                return `Error editing file: ${error.message}`;
            }
        }
    });
};