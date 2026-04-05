import { describe, it, expect, beforeAll, afterAll } from "bun:test";
import { mkdir, rm, writeFile } from "fs/promises";
import { join } from "path";

import { validateAndResolvePath } from "./utils";
import { createListFilesTool } from "./createListFiles";
import { createReadFileTool } from "./createReadFile";
import { createGrepSearchTool } from "./createGrepSearch";
import { createAnalyzeFileTool } from "./createAnalyzeFile";

const TEST_ROOT = join(process.cwd(), ".test-sandbox-pro");

// 🚨 绝对防御锁
const SAFE_GUARD = () => {
    if (TEST_ROOT === process.cwd() || TEST_ROOT === "/" || TEST_ROOT.length < 10) {
        throw new Error("💥 极其危险的自毁操作已被拦截！");
    }
};

describe("FileSystem Tools (Pro Test Suite)", () => {
    beforeAll(async () => {
        SAFE_GUARD();
        await rm(TEST_ROOT, { recursive: true, force: true }).catch(() => {});

        // 1. 创建复杂的目录层级
        await mkdir(join(TEST_ROOT, "src", "components"), { recursive: true });
        await mkdir(join(TEST_ROOT, "src", "utils"), { recursive: true });
        await mkdir(join(TEST_ROOT, "dist"), { recursive: true });
        await mkdir(join(TEST_ROOT, ".git"), { recursive: true });

        // 2. 写入 .gitignore (屏蔽 dist)
        await writeFile(join(TEST_ROOT, ".gitignore"), "dist/\n.env\n*.log");
        await writeFile(join(TEST_ROOT, "dist", "bundle.js"), "console.log('compiled');");
        await writeFile(join(TEST_ROOT, "error.log"), "app crashed");

        // 3. 构造一个用于翻页测试的长文件 (50行)
        const longFileLines = Array.from({ length: 50 }, (_, i) => `Line ${i + 1}: ${i % 2 === 0 ? 'Even' : 'Odd'}`);
        await writeFile(join(TEST_ROOT, "src", "utils", "largeHelper.ts"), longFileLines.join("\n"));

        // 4. 构造用于 Grep 边界和熔断测试的文件
        // 第一行匹配、最后一行匹配
        await writeFile(join(TEST_ROOT, "src", "components", "Boundary.tsx"),
            "export const START = true;\n" +
            "const a = 1;\n" +
            "const b = 2;\n" +
            "export const END = true;"
        );

        // 故意写入 40 行 TODO，用于测试 30条 的熔断截断机制
        const spamLines = Array.from({ length: 40 }, (_, i) => `// TODO: fix bug ${i}`);
        await writeFile(join(TEST_ROOT, "src", "components", "Spam.tsx"), spamLines.join("\n"));

        // 5. 其他常规文件
        await writeFile(join(TEST_ROOT, "package.json"), JSON.stringify({ name: "test" }));
    });

    afterAll(async () => {
        SAFE_GUARD();
        await rm(TEST_ROOT, { recursive: true, force: true }).catch(() => {});
    });

    // --- 1. utils 核心安全验证 ---
    describe("validateAndResolvePath", () => {
        it("应该正确解析项目根目录内的各种合法路径", () => {
            expect(validateAndResolvePath(TEST_ROOT, "src/components")).toBe(join(TEST_ROOT, "src/components"));
            expect(validateAndResolvePath(TEST_ROOT, "./package.json")).toBe(join(TEST_ROOT, "package.json"));
            expect(validateAndResolvePath(TEST_ROOT, ".")).toBe(TEST_ROOT);
        });

        it("应该拦截恶意拼接的目录穿越攻击", () => {
            expect(() => validateAndResolvePath(TEST_ROOT, "../system_file")).toThrow("Access denied");
            expect(() => validateAndResolvePath(TEST_ROOT, "src/../../package.json")).toThrow("Access denied");
        });
    });

    // --- 2. ListFiles 目录探测 ---
    describe("createListFilesTool", () => {
        it("应该递归列出文件，彻底屏蔽 .gitignore 及默认忽略项", async () => {
            const tool = createListFilesTool(TEST_ROOT);
            const result = await tool.invoke({ directory: "." });

            // 应该有的
            expect(result).toContain("src/components/Boundary.tsx");
            expect(result).toContain("package.json");
            expect(result).toContain(".gitignore");

            // 绝对不应该有的 (被 ignore 或内置过滤)
            expect(result).not.toContain("dist/bundle.js");
            expect(result).not.toContain("error.log");

            // ✅ 改成加上斜杠，专门匹配 .git 目录下的文件
            expect(result).not.toContain(".git/");
        });

        it("应该支持精确的 Glob Pattern 和子目录过滤", async () => {
            const tool = createListFilesTool(TEST_ROOT);
            // 查 src/utils 目录下的 .ts 文件
            const result = await tool.invoke({ pattern: "**/*.ts", directory: "src/utils" });

            expect(result).toContain("largeHelper.ts");
            expect(result).not.toContain("Boundary.tsx"); // 不在 utils 目录下
        });
    });

    // --- 3. ReadFile 分页与边界探索 ---
    describe("createReadFileTool", () => {
        it("精准分页：应该能截取中间的部分行", async () => {
            const tool = createReadFileTool(TEST_ROOT);
            const result = await tool.invoke({ filePath: "src/utils/largeHelper.ts", offset: 10, limit: 3 });

            expect(result).toContain("Showing lines 10 to 12");
            // ✅ 正确的断言：
            expect(result).toContain("10 | Line 10: Odd");
            expect(result).toContain("11 | Line 11: Even");
            expect(result).toContain("12 | Line 12: Odd");

            expect(result).not.toContain("9 |");
            expect(result).not.toContain("13 |");
            expect(result).toContain("NOTE: File continues below"); // 还有剩余内容
        });

        it("EOF边界：超长 limit 或跨界 offset 应该被安全处理", async () => {
            const tool = createReadFileTool(TEST_ROOT);
            // 从 45 行开始读 100 行（文件只有 50 行）
            const result = await tool.invoke({ filePath: "src/utils/largeHelper.ts", offset: 45, limit: 100 });

            expect(result).toContain("Showing lines 45 to 50");
            // ❌ 把下面这行：
            // expect(result).toContain("50 | Line 50: Even");
            // ✅ 改成这样：
            expect(result).toContain("50 | Line 50: Odd");

            expect(result).toContain("EOF"); // 读到底了
        });

        it("负数边界：错误的 offset 应该被自动修正为 1", async () => {
            const tool = createReadFileTool(TEST_ROOT);
            const result = await tool.invoke({ filePath: "package.json", offset: -5 });
            expect(result).toContain("Showing lines 1 to");
        });
    });

    // --- 4. GrepSearch 极客搜索与熔断 ---
    describe("createGrepSearchTool", () => {
        it("数组越界防御：命中首行和末行时不应抛出异常", async () => {
            const tool = createGrepSearchTool(TEST_ROOT);

            // 命中首行
            const resStart = await tool.invoke({ query: "START" });
            expect(resStart).toContain("1: export const START = true;");
            expect(resStart).toContain("2: const a = 1;"); // 应包含下文

            // 命中末行
            const resEnd = await tool.invoke({ query: "END" });
            expect(resEnd).toContain("3: const b = 2;"); // 应包含上文
            expect(resEnd).toContain("4: export const END = true;");
        });

        it("保护机制熔断：超过 30 次命中应该被截断", async () => {
            const tool = createGrepSearchTool(TEST_ROOT);
            // Spam.tsx 里有 40 行 TODO
            const result = await tool.invoke({ query: "TODO" });

            // 应该包含 30 次命中并附带提示
            expect(result).toContain("... and 10 more matches. Try making your query more specific.");
            // 确认第 30 行在结果中，但第 31 行不在上下文中作为命中结果出现
            expect(result).toContain("30: // TODO: fix bug 29");
            expect(result).not.toContain("32: // TODO: fix bug 31");
        });

        it("支持正则和忽略大小写", async () => {
            const tool = createGrepSearchTool(TEST_ROOT);
            // 查找 L 打头，紧跟 ine 的正则，忽略大小写
            const result = await tool.invoke({ query: "^line \\d+", directory: "src/utils" });
            expect(result).toContain("largeHelper.ts:1: Line 1");
        });
    });

    // --- 5. AnalyzeFile 策略分发 ---
    describe("createAnalyzeFileTool", () => {
        it("应该正确解析并提取 JSON 的 Root Keys", async () => {
            const tool = createAnalyzeFileTool(TEST_ROOT);
            const result = await tool.invoke({ filePath: "package.json" });
            expect(result).toBe("JSON Structure Summary:\nRoot Keys: name");
        });
    });
});