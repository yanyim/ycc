// src/store/storage.ts
import {promises as fs} from 'fs';
import path from 'path';
import type {StateStorage} from 'zustand/middleware';

export const CLI_DIR = path.join(process.cwd(), '.ycc');
export const SESSIONS_DIR = path.join(CLI_DIR, 'sessions');

export const createFileStorage = (filename: string): StateStorage => {
    const filePath = path.join(CLI_DIR, filename);

    return {
        getItem: async (name: string): Promise<string | null> => {
            try {
                return await fs.readFile(filePath, 'utf-8');
            } catch (error: any) {
                if (error.code === 'ENOENT') return null;
                throw error;
            }
        },
        setItem: async (name: string, value: string): Promise<void> => {
            try {
                await fs.mkdir(CLI_DIR, {recursive: true});
                // value 已经是 Zustand 传过来的 JSON 字符串了
                // 我们把它 parse 出来，再用 null, 2 格式化重新写盘，保证人类可读性
                const formattedJson = JSON.stringify(JSON.parse(value), null, 2);
                await fs.writeFile(filePath, formattedJson, 'utf-8');
            } catch (error) {
                console.error(`\n[Storage Error] 保存失败: ${error}`);
            }
        },
        removeItem: async (name: string): Promise<void> => {
            try {
                await fs.unlink(filePath);
            } catch (error) {
                // 忽略不存在的错误
            }
        },
    }
}