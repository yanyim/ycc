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

        // 1. 如果没有会话且是用户消息，生成一个 ID
        if (!currentSessionId && message.role === 'user') {
            const safeName = message.content.substring(0, 10).replace(/[^a-zA-Z0-9\u4e00-\u9fa5]/g, '_');
            const timestamp = new Date().getTime();
            currentSessionId = `${safeName}_${timestamp}`;
            set({currentSessionId});
        }

        // 🌟 核心修复 1：无论有没有 Session ID，都必须先更新内存中的 messages 数组！
        // 这样 React UI 才能立刻收到状态变化并渲染出提示语。
        const newMessages = [...messages, message];
        set({messages: newMessages});

        // 🌟 核心修复 2：只有存在 Session ID (即真正开始聊天了)，才执行文件落盘持久化。
        // 系统命令产生的独立提示语不持久化是可以接受的。
        if (!currentSessionId) return;

        try {
            await fs.mkdir(SESSIONS_DIR, {recursive: true});
            const filePath = path.join(SESSIONS_DIR, `${currentSessionId}.json`);
            const tempFilePath = `${filePath}.tmp`;

            await Bun.write(tempFilePath, JSON.stringify(newMessages, null, 2));
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
