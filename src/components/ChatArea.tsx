import React from 'react';
import { Box, Text, Static } from 'ink';
import type { Message } from '../types';

interface ChatAreaProps {
    history: Message[];
    currentStream: string;
}

export const ChatArea: React.FC<ChatAreaProps> = ({ history, currentStream }) => {
    return (
        <Box flexDirection="column">
            {/* 1. 已完成的对话：作为静态日志永久打印到终端上方的屏幕 */}
            <Static items={history}>
                {(msg) => (
                    <Box key={msg.id} marginBottom={1} flexDirection="row">
                        <Text bold color={msg.role === 'ai' ? 'blue' : msg.role === 'user' ? 'green' : 'yellow'}>
                            {msg.role === 'ai' ? 'AI:   ' : msg.role === 'system' ? 'SYS:  ' : 'USER: '}
                        </Text>
                        <Text>{msg.content}</Text>
                    </Box>
                )}
            </Static>

            {/* 2. 正在生成的对话：位于终端底部，随流式数据动态更新 */}
            {currentStream && (
                <Box marginBottom={1} flexDirection="row">
                    <Text bold color="blue">AI:   </Text>
                    <Text>{currentStream}</Text>
                </Box>
            )}
        </Box>
    );
};