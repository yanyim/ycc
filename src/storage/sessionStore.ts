// src/store/sessionStore.ts
import {createStore} from 'zustand';
import {promises as fs} from 'fs';
import path from 'path';
import {SESSIONS_DIR} from './storage';
import type {Message} from '../types';

export interface SessionState {
    currentSessionId: string | null;
    messages: Message[];

    // 初始化或切换会话
    loadSession: (sessionId: string) => Promise<void>;
    // 发送消息，如果没会话则创建新会话（文件名）
    addMessage: (message: Message) => Promise<void>;

    // 🌟 新增：清空当前会话方法
    clearMessages: () => Promise<void>;
}

export const createSessionStore = () => {
    return createStore<SessionState>()((set, get) => ({
        currentSessionId: null,
        messages: [],

        loadSession: async (sessionId: string) => {
            try {
                const filePath = path.join(SESSIONS_DIR, `${sessionId}.json`);
                const content = await fs.readFile(filePath, 'utf-8');
                set({currentSessionId: sessionId, messages: JSON.parse(content)});
            } catch (error: any) {
                if (error.code === 'ENOENT') {
                    // 新会话
                    set({currentSessionId: sessionId, messages: []});
                }
            }
        },

        addMessage: async (message: Message) => {
            let {currentSessionId, messages} = get();

            // 如果是会话的第一句话，根据内容生成会话名（安全处理特殊字符）
            if (!currentSessionId && message.role === 'user') {
                // 取前10个字符，替换掉不合法的路径字符
                const safeName = message.content.substring(0, 10).replace(/[^a-zA-Z0-9\u4e00-\u9fa5]/g, '_');
                const timestamp = new Date().getTime();
                currentSessionId = `${safeName}_${timestamp}`;
                set({currentSessionId});
            }

            if (!currentSessionId) return; // 防御性判断

            const newMessages = [...messages, message];
            set({messages: newMessages});

            // 异步将此会话写入对应的独立文件
            try {
                await fs.mkdir(SESSIONS_DIR, {recursive: true});
                const filePath = path.join(SESSIONS_DIR, `${currentSessionId}.json`);
                // 对于历史记录，直接覆盖写整个数组即可
                await fs.writeFile(filePath, JSON.stringify(newMessages, null, 2), 'utf-8');
            } catch (err) {
                console.error('保存会话失败', err);
            }
        },

        clearMessages: async () => {
            set({messages: []});
            const {currentSessionId} = get();
            if (currentSessionId) {
                try {
                    // 同步将空数组覆写到文件中
                    const filePath = path.join(SESSIONS_DIR, `${currentSessionId}.json`);
                    await fs.writeFile(filePath, '[]', 'utf-8');
                } catch (err) {
                    console.error('清空会话文件失败', err);
                }
            }
        }
    }));
};