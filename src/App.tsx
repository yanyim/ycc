import React from 'react';
import { Box } from 'ink';
import { streamText, type ModelMessage } from 'ai';
import { createOpenAI } from '@ai-sdk/openai';
import { Welcome } from './components/Welcome';
import { ChatArea } from './components/ChatArea';
import { CommandInput } from './components/CommandInput';
import { commandRegistry } from './commands';
import type { Message } from './types';

// 🌟 引入状态 Hook
import { useSessionStore, useRuntimeStore, useConfigStore } from './storage';

const customModel = createOpenAI({
    apiKey: process.env.AI_API_KEY || '',
    baseURL: process.env.AI_BASE_URL || '',
});

export const App: React.FC = () => {
    // 1. Session Store (历史与文件)
    const messages = useSessionStore(state => state.messages);
    const addMessage = useSessionStore(state => state.addMessage);
    const clearMessages = useSessionStore(state => state.clearMessages);

    // 2. Runtime Store (纯内存与 UI 渲染)
    const currentStream = useRuntimeStore(state => state.currentStream);
    const setCurrentStream = useRuntimeStore(state => state.setCurrentStream);
    const isGenerating = useRuntimeStore(state => state.isGenerating);
    const setIsGenerating = useRuntimeStore(state => state.setIsGenerating);

    // 3. Config Store (读取配置，此处可选)
    const modelConfig = useConfigStore(state => state.modelConfig);

    const handleInputSubmit = async (text: string) => {
        if (isGenerating) return;

        const userMsg: Message = { id: crypto.randomUUID(), role: 'user', content: text };

        // --- 命令分发处理 ---
        if (text.startsWith('/')) {
            const [cmdNameWithSlash, ...args] = text.trim().split(' ');
            const cmdName = (cmdNameWithSlash || '').slice(1);
            const command = commandRegistry.get(cmdName);

            if (command) {
                try {
                    // 🌟 传入全新的 Context
                    await command.execute({ args, options: {}, messages, addMessage, clearMessages });
                } catch (error: any) {
                    await addMessage({ id: crypto.randomUUID(), role: 'system', content: `[命令执行失败]: ${error.message}` });
                }
            } else {
                await addMessage(userMsg);
                await addMessage({ id: crypto.randomUUID(), role: 'system', content: `未知命令: ${cmdName}` });
            }
            return;
        }

        // --- 对话处理 ---
        setIsGenerating(true);

        // 🌟 固化用户消息 (会自动更新 UI 并写本地文件)
        await addMessage(userMsg);

        // 为 AI 准备最新的完整上下文
        const currentContext = [...messages, userMsg];

        try {
            const aiMessages: ModelMessage[] = currentContext
                .filter((msg) => msg.role !== 'system')
                .map((msg) => ({
                    role: (msg.role === 'ai' ? 'assistant' : 'user') as 'assistant' | 'user',
                    content: msg.content,
                }));

            const result = await streamText({
                // 你也可以在此处使用 modelConfig.model 等全局配置
                model: customModel.chat('qwen/qwen3.6-plus:free'),
                messages: aiMessages,
            });

            let fullText = '';
            for await (const textPart of result.textStream) {
                fullText += textPart;
                setCurrentStream(fullText); // 高频修改内存状态
            }

            setCurrentStream(''); // 流式结束，清空内存态
            // 🌟 固化 AI 的结果，自动写入文件
            await addMessage({ id: crypto.randomUUID(), role: 'ai', content: fullText });

        } catch (error: any) {
            setCurrentStream('');
            await addMessage({ id: crypto.randomUUID(), role: 'system', content: `[请求失败]: ${error.message}` });
        } finally {
            setIsGenerating(false);
        }
    };

    return (
        <Box flexDirection="column">
            {messages.length === 0 && <Welcome />}
            <ChatArea history={messages} currentStream={currentStream} />
            <CommandInput onSubmit={handleInputSubmit} />
        </Box>
    );
};