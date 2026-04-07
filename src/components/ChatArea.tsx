// src/components/ChatArea.tsx
import React from 'react';
import { Box, Text, Static } from 'ink';
import type { Message } from '../types';

interface ChatAreaProps {
    history: Message[];
    currentStream: string;
}

export const ChatArea: React.FC<ChatAreaProps> = ({ history, currentStream }) => {
    return (
        <>
            {/* 1. 已完成的对话：作为静态日志永久打印到终端上方的屏幕 */}
            <Static items={history}>
                {(msg: any) => {
                    // 兼容之前加的 Welcome 占位符逻辑
                    if (msg.isWelcome) {
                        return <Text key={msg.id} dimColor>✨ 欢迎进入智能体 CLI 控制台 ✨</Text>;
                    }

                    return (
                        <Box key={msg.id} marginBottom={0}>
                            {/* 🌟 核心修复 1：使用 Text 内联嵌套，彻底抛弃 flexDirection="row" */}
                            <Text>
                                <Text bold color={msg.role === 'ai' ? 'blue' : msg.role === 'user' ? 'green' : 'yellow'}>
                                    {msg.role === 'ai' ? 'AI:   ' : msg.role === 'system' ? 'SYS:  ' : 'USER: '}
                                </Text>
                                {/* 🌟 核心修复 2：使用 trimStart() 过滤掉 AI 偶尔输出的幽灵换行符 */}
                                {msg.content.trimStart()}
                            </Text>
                        </Box>
                    );
                }}
            </Static>

            {/* 2. 正在生成的对话：位于终端底部，随流式数据动态更新 */}
            {currentStream && (
                <Box marginBottom={0}>
                    <Text>
                        <Text bold color="blue">AI:   </Text>
                        {currentStream.trimStart()}
                    </Text>
                </Box>
            )}
        </>
    );
};