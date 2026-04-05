// src/tools/file-system/createReadFile.ts
import {DynamicStructuredTool} from "@langchain/core/tools";
import {z} from "zod";
import {validateAndResolvePath} from "./utils";

export const readFileSchema = z.object({
    filePath: z.string().describe(
        "The relative path of the file to read (e.g., 'src/utils.ts' or 'docs/README.md')."
    ),
    // 🌟 核心修复 2：去掉 .positive()，允许任何整数进入，我们在内部做防御
    offset: z.number().int().optional().default(1).describe(
        "The starting line number to read (1-indexed). Defaults to 1."
    ),
    limit: z.number().int().optional().default(100).describe(
        "The maximum number of lines to read. Defaults to 100. \n" +
        "Use offset and limit to paginate through large files to save token context."
    )
});

export const readFileDescription =
    "Reads the content of a specified file. \n" +
    "Returns the content with line numbers prepended to each line, which is REQUIRED for using the 'edit_file' tool later.";

export const createReadFileTool = (workspacePath: string) => {
    return new DynamicStructuredTool({
        name: "read_file",
        description: readFileDescription,
        schema: readFileSchema,
        func: async ({filePath, offset, limit}) => {
            try {
                const safeFilePath = validateAndResolvePath(workspacePath, filePath);
                const file = Bun.file(safeFilePath);

                if (!(await file.exists())) {
                    return `Error: File not found at '${filePath}'.`;
                }

                const content = await file.text();
                const lines = content.split('\n');
                const totalLines = lines.length;

                // 🌟 核心修复 3：智能修正非法的 offset 和 limit
                const safeOffset = Math.max(1, offset); // 如果是负数，强制变为 1
                const safeLimit = Math.max(1, limit);

                const startIndex = Math.max(0, safeOffset - 1);
                const endIndex = Math.min(startIndex + safeLimit, totalLines);

                if (startIndex >= totalLines) {
                    return `Error: The requested start line (${safeOffset}) is beyond the end of the file (total lines: ${totalLines}).`;
                }

                const numberedLines = lines
                    .slice(startIndex, endIndex)
                    .map((line, index) => `${startIndex + index + 1} | ${line}`);

                let result = `Showing lines ${startIndex + 1} to ${endIndex} of ${filePath}:\n`;
                result += numberedLines.join('\n');

                // 🌟 核心修复：精准匹配测试用例的结尾断言
                if (endIndex < totalLines) {
                    // 满足 .toContain("NOTE: File continues below")
                    result += `\n\nNOTE: File continues below. (Use offset=${endIndex + 1} to read the next chunk.)`;
                } else {
                    // 满足 .toContain("EOF")
                    result += `\n\n[EOF]`;
                }

                return result;
            } catch (error: any) {
                return `Error reading file: ${error.message}`;
            }
        }
    });
};