import { resolve, relative, isAbsolute } from "path";

/**
 * 核心防御逻辑：强制沙箱边界
 * @param projectRoot 项目根目录绝对路径
 * @param targetPath 大模型传入的目标路径
 * @returns 安全的绝对路径
 */
export function validateAndResolvePath(projectRoot: string, targetPath: string): string {
    const absolutePath = isAbsolute(targetPath)
        ? targetPath
        : resolve(projectRoot, targetPath);

    const rel = relative(projectRoot, absolutePath);

    // 防御目录穿越攻击 (Directory Traversal)
    if (rel.startsWith("..") || isAbsolute(rel)) {
        throw new Error(`Access denied: Path '${targetPath}' is outside the project root.`);
    }

    return absolutePath;
}