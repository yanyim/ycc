import type { Message } from '../types';
import type { ModelInfo } from '../storage/configStore';

export interface CommandContext {
    args: string[];
    options: Record<string, any>;

    // 注入必要的上下文状态
    messages: Message[];
    models: ModelInfo[];

    // 注入状态修改方法
    addMessage: (message: Message) => Promise<void>;
    clearMessages: () => Promise<void>;

    // 注入 store 相关的原子化状态更新方法 (方便命令实现直接修改 UI 模式或配置)
    setMode: (mode: 'normal' | 'model-selection') => void;
    setAvailableCommands: (commands: { label: string; value: string }[]) => void;
    setCurrentModel: (model: string) => void;
}

export interface Command {
    name: string;
    aliases?: string[];
    description: string;
    isHidden?: boolean;
    type: 'local' | 'agentic';
    execute: (context: CommandContext) => Promise<void | string>;
}