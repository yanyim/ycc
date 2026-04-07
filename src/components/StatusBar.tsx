// src/components/StatusBar.tsx
import React, { useState, useEffect } from 'react';
import { Box, Text } from 'ink';

interface StatusBarProps {
    status: { agentName: string; statusText: string } | null;
}

const frames = ['⠋', '⠙', '⠹', '⠸', '⠼', '⠴', '⠦', '⠧', '⠇', '⠏'];

export const StatusBar: React.FC<StatusBarProps> = ({ status }) => {
    const [frameIdx, setFrameIdx] = useState(0);

    useEffect(() => {
        if (!status) return;
        const timer = setInterval(() => {
            setFrameIdx((prev) => (prev + 1) % frames.length);
        }, 80);
        return () => clearInterval(timer);
    }, [status]);

    if (!status) return null;

    const getAgentColor = (name: string) => {
        if (name.toLowerCase().includes('supervisor')) return 'magenta';
        if (name.toLowerCase().includes('coder')) return 'yellow';
        return 'cyan';
    };

    const agentColor = getAgentColor(status.agentName);

    return (
        // 🌟 核心修复点：
        // 1. 绝对不要加 borderStyle="round"！
        // 2. 加上 flexDirection="row"
        <Box paddingX={1} marginTop={0} flexDirection="row">
            <Text color="cyan">{frames[frameIdx]} </Text>
            <Text color={agentColor} bold>[{status.agentName}] </Text>
            {/* 🌟 核心修复点 3：强制截断，绝不换行 */}
            <Text color="gray" wrap="truncate">
                {status.statusText}
            </Text>
        </Box>
    );
};