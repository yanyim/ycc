import {isAbsolute, relative, resolve} from "path";


/**
 * 核心防御逻辑：强制沙箱边界与路径清洗
 * @param projectRoot 项目根目录绝对路径
 * @param targetPath 大模型传入的目标路径
 * @returns 安全的绝对路径
 */
export function validateAndResolvePath(projectRoot: string, targetPath: string): string {
    // 🌟 核心容错处理：剥离大模型习惯性添加的根目录斜杠
    // 如果大模型传入 "/docs/readme.md" 或 "//docs"，正则会将其替换为 "docs/readme.md"
    const sanitizedPath = targetPath.replace(/^\/+/, '');

    // 因为 sanitizedPath 已经移除了开头的斜杠，resolve 一定会将其与 projectRoot 拼接
    const absolutePath = resolve(projectRoot, sanitizedPath);

    const rel = relative(projectRoot, absolutePath);

    // 防御目录穿越攻击 (Directory Traversal)
    if (rel.startsWith("..") || isAbsolute(rel)) {
        throw new Error(`Access denied: Path '${targetPath}' is outside the project root.`);
    }

    return absolutePath;
}
