import type { Message } from '../types';

export interface CommandContext {
    args: string[];
    options: Record<string, any>;

    // 注入必要的上下文状态
    messages: Message[];

    // 注入状态修改方法
    addMessage: (message: Message) => Promise<void>;
    clearMessages: () => Promise<void>;
}

export interface Command {
    name: string;
    aliases?: string[];
    description: string;
    isHidden?: boolean;
    type: 'local' | 'agentic';
    execute: (context: CommandContext) => Promise<void | string>;
}