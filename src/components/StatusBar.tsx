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

    // 为不同的 Agent 分配不同的颜色标识
    const getAgentColor = (name: string) => {
        if (name.toLowerCase().includes('supervisor')) return 'magenta';
        if (name.toLowerCase().includes('explore')) return 'blue';
        if (name.toLowerCase().includes('coder')) return 'yellow';
        if (name.toLowerCase().includes('verifier')) return 'red';
        return 'cyan';
    };

    const agentColor = getAgentColor(status.agentName);

    return (
        <Box paddingX={1} borderStyle="round" borderColor="gray" marginY={0}>
            <Text color="cyan">{frames[frameIdx]} </Text>
            <Text color={agentColor} bold>[{status.agentName}] </Text>
            <Text color="white">{status.statusText}</Text>
        </Box>
    );
};