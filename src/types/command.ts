import type { Message } from '../types';
import type React from 'react';

export interface CommandContext {
    args: string[];
    options: Record<string, any>;
    history: Message[];
    setHistory: React.Dispatch<React.SetStateAction<Message[]>>;
}

export interface Command {
    name: string;
    aliases?: string[];
    description: string;
    isHidden?: boolean;
    type: 'local' | 'agentic';
    execute: (context: CommandContext) => Promise<void | string>;
}
