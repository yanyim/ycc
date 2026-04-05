import { tool } from "@langchain/core/tools";
import { z } from "zod";
import { validateAndResolvePath } from "./utils";

export function createReadFileTool(projectRoot: string) {
    return tool(
        async ({ filePath, offset = 1, limit = 100 }) => {
            try {
                const absPath = validateAndResolvePath(projectRoot, filePath);
                const file = Bun.file(absPath);

                if (!(await file.exists())) return `Error: File '${filePath}' not found.`;

                const text = await file.text();
                const lines = text.split("\n");
                const totalLines = lines.length;

                const start = Math.max(1, offset) - 1;
                const end = limit ? start + limit : totalLines;

                const content = lines.slice(start, end)
                    .map((line, i) => `${start + i + 1} | ${line}`)
                    .join("\n");

                return [
                    `File: ${filePath} (Total lines: ${totalLines})`,
                    `Showing lines ${start + 1} to ${Math.min(end, totalLines)}`,
                    "---",
                    content,
                    "---",
                    totalLines > end ? "NOTE: File continues below. Use 'offset' and 'limit' to read more." : "EOF"
                ].join("\n");
            } catch (error: any) {
                return `Error reading file: ${error.message}`;
            }
        },
        {
            name: "read_file",
            description: "Read text file content with line numbers. Use limit=100 for large files.",
            schema: z.object({
                filePath: z.string().describe("Relative path to the file"),
                offset: z.number().optional().describe("Start line number (1-indexed)"),
                limit: z.number().optional().describe("Number of lines to read"),
            }),
        }
    );
}