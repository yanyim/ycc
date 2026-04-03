import React, { useState } from 'react';
import { Box } from 'ink';
import { streamText, type ModelMessage } from 'ai';
import { createOpenAI } from '@ai-sdk/openai';
import { Welcome } from './components/Welcome';
import { ChatArea } from './components/ChatArea';
import { CommandInput } from './components/CommandInput';
import type { Message } from './types';

const customModel = createOpenAI({
    apiKey: process.env.AI_API_KEY || '',
    baseURL: process.env.AI_BASE_URL || '',
});

export const App: React.FC = () => {
    // 分离状态：已固化的历史记录 vs 当前正在流式的字符串
    const [history, setHistory] = useState<Message[]>([]);
    const [currentStream, setCurrentStream] = useState('');
    const [isGenerating, setIsGenerating] = useState(false);

    const handleInputSubmit = async (text: string) => {
        if (isGenerating) return;

        if (text === '/exit') process.exit(0);
        if (text === '/clear') {
            console.clear();
            setHistory([]);
            return;
        }

        const userMsg: Message = { id: crypto.randomUUID(), role: 'user', content: text };

        if (text.startsWith('/')) {
            setHistory((prev) => [
                ...prev,
                userMsg,
                { id: crypto.randomUUID(), role: 'system', content: `执行了内部命令: ${text}` }
            ]);
            return;
        }

        setIsGenerating(true);

        // 🌟 修复核心：在当前作用域直接组装好完整的上下文数组
        const currentContext = [...history, userMsg];

        // 更新 UI 状态（屏幕渲染）
        setHistory(currentContext);

        try {
            // 直接使用刚才组装好的 currentContext 构建 AI 消息格式
            const aiMessages: ModelMessage[] = currentContext
                .filter((msg) => msg.role !== 'system')
                .map((msg) => ({
                    role: (msg.role === 'ai' ? 'assistant' : 'user') as 'assistant' | 'user',
                    content: msg.content,
                }));

            // 发起流式请求
            const result = await streamText({
                model: customModel.chat('gpt-3.5-turbo'),
                messages: aiMessages,
            });

            let fullText = '';

            for await (const textPart of result.textStream) {
                fullText += textPart;
                setCurrentStream(fullText);
            }

            setCurrentStream('');
            setHistory((prev) => [
                ...prev,
                { id: crypto.randomUUID(), role: 'ai', content: fullText }
            ]);

        } catch (error: any) {
            setCurrentStream('');
            setHistory((prev) => [
                ...prev,
                { id: crypto.randomUUID(), role: 'system', content: `[请求失败]: ${error.message}` }
            ]);
        } finally {
            setIsGenerating(false);
        }
    };

    return (
        <Box flexDirection="column">
            {/* 只有在没有对话历史时，才显示欢迎界面 */}
            {history.length === 0 && <Welcome />}

            <ChatArea history={history} currentStream={currentStream} />
            <CommandInput onSubmit={handleInputSubmit} />
        </Box>
    );
};