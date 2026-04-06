// src/storage/sessionStore.ts
import {promises as fs} from 'fs';
import path from 'path';
import {SESSIONS_DIR} from './storage';
import type {Message} from '../types';
import type {StoreApi, UseBoundStore} from "zustand";
import {create,} from "zustand";

export interface SessionState {
    currentSessionId: string | null;
    messages: Message[];
    loadSession: (sessionId: string) => Promise<void>;
    addMessage: (message: Message) => Promise<void>;
    clearMessages: () => Promise<void>;
}

export const useSessionStore: UseBoundStore<StoreApi<SessionState>> = create<SessionState>((set, get) => ({
    currentSessionId: null,
    messages: [],

    loadSession: async (sessionId: string) => {
        const filePath = path.join(SESSIONS_DIR, `${sessionId}.json`);
        const file = Bun.file(filePath);

        // 🌟 拥抱 Bun: 判断是否存在
        if (!(await file.exists())) {
            set({currentSessionId: sessionId, messages: []});
            return;
        }

        try {
            // 🌟 拥抱 Bun: 极速读取文本
            const content = await file.text();
            set({currentSessionId: sessionId, messages: JSON.parse(content)});
        } catch (error: any) {
            console.error('加载会话失败', error);
        }
    },

    addMessage: async (message: Message) => {
        let {currentSessionId, messages} = get();

        if (!currentSessionId && message.role === 'user') {
            const safeName = message.content.substring(0, 10).replace(/[^a-zA-Z0-9\u4e00-\u9fa5]/g, '_');
            const timestamp = new Date().getTime();
            currentSessionId = `${safeName}_${timestamp}`;
            set({currentSessionId});
        }

        if (!currentSessionId) return;

        const newMessages = [...messages, message];
        set({messages: newMessages});

        try {
            await fs.mkdir(SESSIONS_DIR, {recursive: true});
            const filePath = path.join(SESSIONS_DIR, `${currentSessionId}.json`);
            const tempFilePath = `${filePath}.tmp`;

            // 🌟 拥抱 Bun: 使用 Bun.write 写入临时文件
            await Bun.write(tempFilePath, JSON.stringify(newMessages, null, 2));

            // 原子化替换
            await fs.rename(tempFilePath, filePath);
        } catch (err) {
            console.error('保存会话失败', err);
        }
    },

    clearMessages: async () => {
        set({messages: []});
        const {currentSessionId} = get();
        if (currentSessionId) {
            try {
                const filePath = path.join(SESSIONS_DIR, `${currentSessionId}.json`);
                // 🌟 拥抱 Bun: 极速覆写
                await Bun.write(filePath, '[]');
            } catch (err) {
                console.error('清空会话文件失败', err);
            }
        }
    }

}))
