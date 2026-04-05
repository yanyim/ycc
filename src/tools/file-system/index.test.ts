import { describe, it, expect, beforeAll, afterAll } from "bun:test";
import { mkdir, rm, writeFile } from "fs/promises";
import { join } from "path";

// 引入我们要测试的工具
import { validateAndResolvePath } from "./utils";
import { createListFilesTool } from "./createListFiles";
import { createReadFileTool } from "./createReadFile";
import { createGrepSearchTool } from "./createGrepSearch";
import { createAnalyzeFileTool } from "./createAnalyzeFile";

// 设定测试专用的沙箱根目录
const TEST_ROOT = join(process.cwd(), ".test-sandbox");

describe("FileSystem Tools", () => {
    // 🔴 1. 准备阶段：在每次运行测试前，动态创建测试目录和文件
    beforeAll(async () => {
        // 确保清理上一次可能残留的目录
        await rm(TEST_ROOT, { recursive: true, force: true });

        // 创建目录结构
        await mkdir(join(TEST_ROOT, "src"), { recursive: true });
        await mkdir(join(TEST_ROOT, "ignored_dir"), { recursive: true });
        await mkdir(join(TEST_ROOT, ".git"), { recursive: true });

        // 写入测试文件
        await writeFile(join(TEST_ROOT, ".gitignore"), "ignored_dir/\n.env");
        await writeFile(join(TEST_ROOT, ".env"), "SECRET=123");
        await writeFile(join(TEST_ROOT, "ignored_dir", "secret.ts"), "console.log('secret');");
        await writeFile(join(TEST_ROOT, ".git", "config"), "[core]\nrepositoryformatversion = 0");

        await writeFile(join(TEST_ROOT, "src", "index.ts"),
            "import { config } from './config';\n" +
            "function main() {\n" +
            "  console.log('Hello World');\n" +
            "}\n" +
            "main();"
        );
        await writeFile(join(TEST_ROOT, "src", "data.json"), JSON.stringify({ name: "ycc", version: "1.0.0" }));
    });

    // 🟢 2. 清理阶段：测试全部跑完后销毁沙箱
    afterAll(async () => {
        await rm(TEST_ROOT, { recursive: true, force: true });
    });

    // --- 开始分模块测试 ---

    describe("utils -> validateAndResolvePath", () => {
        it("应该正确解析合法的相对路径", () => {
            const result = validateAndResolvePath(TEST_ROOT, "src/index.ts");
            expect(result).toBe(join(TEST_ROOT, "src/index.ts"));
        });

        it("应该拦截越权的目录穿越攻击", () => {
            // 试图访问上一级目录
            expect(() => validateAndResolvePath(TEST_ROOT, "../package.json")).toThrow("Access denied");
        });

        it("应该拦截绝对路径越权", () => {
            expect(() => validateAndResolvePath(TEST_ROOT, "/etc/passwd")).toThrow("Access denied");
        });
    });

    describe("createListFilesTool", () => {
        it("应该列出文件，并正确过滤掉 .gitignore 和默认的 .git 目录", async () => {
            const tool = createListFilesTool(TEST_ROOT);
            const result = await tool.invoke({ directory: "." });

            // 应该包含 src 下的文件和 .gitignore 本身
            expect(result).toContain("src/index.ts");
            expect(result).toContain("src/data.json");
            expect(result).toContain(".gitignore");

            // 绝对不应该包含被 ignore 的文件
            expect(result).not.toContain(".env");
            expect(result).not.toContain("ignored_dir/secret.ts");
            expect(result).not.toContain(".git/config");
        });
    });

    describe("createReadFileTool", () => {
        it("应该正确读取文件并附带行号", async () => {
            const tool = createReadFileTool(TEST_ROOT);
            const result = await tool.invoke({ filePath: "src/index.ts" });

            expect(result).toContain("File: src/index.ts");
            expect(result).toContain("1 | import { config } from './config';");
            expect(result).toContain("5 | main();");
            expect(result).toContain("EOF");
        });

        it("应该支持 offset 和 limit 截取", async () => {
            const tool = createReadFileTool(TEST_ROOT);
            const result = await tool.invoke({ filePath: "src/index.ts", offset: 2, limit: 2 });

            expect(result).toContain("2 | function main() {");
            expect(result).toContain("3 |   console.log('Hello World');");
            expect(result).not.toContain("1 |"); // 不应该包含第一行
            expect(result).toContain("NOTE: File continues below"); // 应该提示未读完
        });

        it("文件不存在时应该返回友好的错误信息", async () => {
            const tool = createReadFileTool(TEST_ROOT);
            const result = await tool.invoke({ filePath: "not_exist.ts" });
            expect(result).toContain("Error: File 'not_exist.ts' not found.");
        });
    });

    describe("createGrepSearchTool", () => {
        it("应该正确通过正则/关键字查找到对应行并返回上下文", async () => {
            const tool = createGrepSearchTool(TEST_ROOT);
            const result = await tool.invoke({ query: "Hello World" });

            // 应该包含命中行及其行号
            expect(result).toContain("src/index.ts:3:   console.log('Hello World');");
            // 应该包含上下文（前一行和后一行）
            expect(result).toContain("src/index.ts:2: function main() {");
            expect(result).toContain("src/index.ts:4: }");
        });

        it("搜索不到时应返回无匹配", async () => {
            const tool = createGrepSearchTool(TEST_ROOT);
            const result = await tool.invoke({ query: "NotFoundString123" });
            expect(result).toBe("No matches found.");
        });
    });

    describe("createAnalyzeFileTool", () => {
        it("对于 JSON 文件应该返回提取的 Root Keys", async () => {
            const tool = createAnalyzeFileTool(TEST_ROOT);
            const result = await tool.invoke({ filePath: "src/data.json" });

            expect(result).toContain("JSON Structure Summary");
            expect(result).toContain("Root Keys: name, version");
        });

        it("对于 TypeScript 文件应该触发策略路由并 Fallback 回滚读取", async () => {
            const tool = createAnalyzeFileTool(TEST_ROOT);
            const result = await tool.invoke({ filePath: "src/index.ts" });

            expect(result).toContain("[AST Analyzer Triggered for .ts]");
            expect(result).toContain("1 | import { config }");
        });
    });
});