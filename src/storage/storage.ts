// src/storage/storage.ts
import { promises as fs } from 'fs';
import path from 'path';
import type { StateStorage } from 'zustand/middleware';

export const CLI_DIR = path.join(process.cwd(), '.ycc');
export const SESSIONS_DIR = path.join(CLI_DIR, 'sessions');

// 全局写锁队列，防止并发写入导致文件指针错乱
let writeLock: Promise<void> = Promise.resolve();

export const createFileStorage = (filename: string): StateStorage => {
    const filePath = path.join(CLI_DIR, filename);

    return {
        getItem: async (name: string): Promise<string | null> => {
            const file = Bun.file(filePath);

            // 🌟 使用 Bun 原生的 exists 判断，更优雅
            if (!(await file.exists())) {
                return null;
            }

            try {
                // 🌟 使用 Bun 原生的极速读取
                return await file.text();
            } catch (error: any) {
                throw error;
            }
        },

        setItem: async (name: string, value: string): Promise<void> => {
            const writeTask = async () => {
                try {
                    await fs.mkdir(CLI_DIR, { recursive: true });
                    const formattedJson = JSON.stringify(JSON.parse(value), null, 2);

                    const tempFilePath = `${filePath}.tmp.${Date.now()}`;

                    // 🌟 核心提速：使用 Bun.write 写入临时文件
                    await Bun.write(tempFilePath, formattedJson);

                    // 利用操作系统的重命名(Rename)特性，瞬间覆盖原文件，绝对安全
                    await fs.rename(tempFilePath, filePath);
                } catch (error) {
                    console.error(`\n[Storage Error] 保存失败: ${error}`);
                }
            };

            writeLock = writeLock.then(writeTask).catch(writeTask);
            await writeLock;
        },

        removeItem: async (name: string): Promise<void> => {
            const file = Bun.file(filePath);
            if (await file.exists()) {
                try {
                    await fs.unlink(filePath);
                } catch (error) {
                    // 忽略异常
                }
            }
        },
    }
}