import React, { useEffect, useMemo } from 'react';
import { Box } from 'ink';
import { streamText, type ModelMessage } from 'ai';
import { createModel } from './utils/ai';
import { Welcome } from './components/Welcome';
import { ChatArea } from './components/ChatArea';
import { CommandInput } from './components/CommandInput';
import { commandRegistry, commandList } from './commands';
import type { Message } from './types';

// 🌟 引入状态 Hook
import { useSessionStore, useRuntimeStore, useConfigStore } from './storage';

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
    const setAvailableCommands = useRuntimeStore(state => state.setAvailableCommands);
    const mode = useRuntimeStore(state => state.mode);
    const setMode = useRuntimeStore(state => state.setMode);

    // 3. Config Store (读取配置，此处可选)
    const models = useConfigStore(state => state.models);
    const currentModelName = useConfigStore(state => state.currentModel);
    const setCurrentModel = useConfigStore(state => state.setCurrentModel);

    // 🌟 动态生成模型实例
    const activeModel = useMemo(() => {
        const modelInfo = models.find(m => m.model === currentModelName);
        const provider = modelInfo?.provider || 'openai';
        return createModel(provider, currentModelName || 'gpt-3.5-turbo');
    }, [models, currentModelName]);

    useEffect(() => {
        // 只有在普通模式下，才加载默认的系统命令
        if (mode === 'normal') {
            setAvailableCommands(
                commandList
                    .filter(cmd => !cmd.isHidden)
                    .map(cmd => ({
                        label: `/${cmd.name} (${cmd.description}) `,
                        value: cmd.name
                    }))
            );
        }
    }, [mode, setAvailableCommands]);

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
                    await command.execute({
                        args,
                        options: {},
                        messages,
                        models,
                        addMessage,
                        clearMessages,
                        setMode,
                        setAvailableCommands,
                        setCurrentModel
                    });
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
                // 使用动态模型
                model: activeModel,
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