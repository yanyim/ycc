import React, { useState } from 'react';
import { Box, Text } from 'ink';
import TextInput from 'ink-text-input';
import SelectInput from 'ink-select-input';

interface CommandInputProps {
    onSubmit: (text: string) => void;
}

// 模拟可用的命令列表
const commands = [
    { label: '查看状态 (status)', value: 'status' },
    { label: '清空屏幕 (clear)', value: 'clear' },
    { label: '退出系统 (exit)', value: 'exit' },
];

export const CommandInput: React.FC<CommandInputProps> = ({ onSubmit }) => {
    const [query, setQuery] = useState('');

    // 只要输入以 / 开头，就进入命令选择模式
    const isCommandMode = query.startsWith('/');

    const handleSubmit = (value: string) => {
        if (!value.trim()) return;
        onSubmit(value);
        setQuery(''); // 发送后清空输入框
    };

    const handleCommandSelect = (item: { label: string; value: string }) => {
        onSubmit(`/${item.value}`);
        setQuery('');
    };

    return (
        <Box flexDirection="column" marginBottom={1}>
            {/* 输入框区域 */}
            <Box borderStyle="round" borderColor="green" paddingX={1}>
                <Text color="green" bold>{'> '} </Text>
                <TextInput
                    value={query}
                    onChange={setQuery}
                    // 当处于命令模式时，禁用文本框的回车提交，让渡给 SelectInput
                    onSubmit={isCommandMode ? undefined : handleSubmit}
                    placeholder="今天想问点什么?"
                />
            </Box>

            {/* 命令选择器面板 (仅在输入 / 时显示) */}
            {isCommandMode && (
                <Box
                    borderStyle="single"
                    borderColor="yellow"
                    paddingX={1}
                    flexDirection="column"
                >
                    <Box marginBottom={1}>
                        <Text color="yellow" bold>
                            按上下键选择命令，回车执行：
                        </Text>
                    </Box>
                    <SelectInput items={commands} onSelect={handleCommandSelect} />
                </Box>
            )}
        </Box>
    );
};