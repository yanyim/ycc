// src/components/CommandInput.tsx
import React, { useState } from 'react';
import { Box, Text, useInput } from 'ink';
import TextInput from 'ink-text-input';
import SelectInput from 'ink-select-input';
import { useRuntimeStore } from '../storage';
import {MultilineInput} from "./MultilineInput";

interface CommandInputProps {
    onSubmit: (text: string) => void;
}

export const CommandInput: React.FC<CommandInputProps> = ({ onSubmit }) => {
    const [query, setQuery] = useState('');
    // 🌟 新增：专门用于强制 TextInput 重新挂载的状态，以此重置光标到句末
    const [inputKey, setInputKey] = useState(0);

    const availableCommands = useRuntimeStore(state => state.availableCommands);
    const mode = useRuntimeStore(state => state.mode);

    const filterKeyword = mode === 'model-selection'
        ? query.toLowerCase().trim()
        : query.startsWith('/')
            ? query.slice(1).toLowerCase().trim()
            : '';

    const filteredCommands = availableCommands.filter(cmd =>
        cmd.value.toLowerCase().includes(filterKeyword) ||
        cmd.label.toLowerCase().includes(filterKeyword)
    );

    const displayCommands = filteredCommands.length > 0
        ? filteredCommands
        : [{ label: '无匹配项 (请修改或按退格键)', value: '' }];

    const isTypingArgs = query.includes(' ');
    const isCommandMode = (query.startsWith('/') && !isTypingArgs) || mode === 'model-selection';

    useInput((input, key) => {
        if (key.tab && filteredCommands.length > 0) {
            // 🌟 修复 TS2532：提取元素并做严谨的判空，完成类型收窄
            const matchItem = filteredCommands[0];
            if (!matchItem) return;

            const match = matchItem.value;
            let newQuery = '';

            if (mode === 'model-selection') {
                newQuery = match;
            } else if (query.startsWith('/') && !isTypingArgs) {
                newQuery = `/${match} `;
            }

            // 只有当内容真的需要改变时才更新状态
            if (newQuery && newQuery !== query) {
                setQuery(newQuery);
                // 🌟 修复光标问题：触发 TextInput 重新挂载，光标会自动置于文本最后
                setInputKey(prev => prev + 1);
            }
        }
    });

    const handleSubmit = (value: string) => {
        if (!value.trim()) return;
        onSubmit(value);
        setQuery('');
        setInputKey(prev => prev + 1); // 提交后顺手重置，保持状态干净
    };

    const handleCommandSelect = (item: { label: string; value: string }) => {
        if (!item.value) return;

        if (mode === 'model-selection') {
            onSubmit(`/models ${item.value}`);
        } else {
            onSubmit(`/${item.value}`);
        }
        setQuery('');
        setInputKey(prev => prev + 1); // 提交后重置光标
    };

    return (
        <Box flexDirection="column" marginBottom={1}>
            <Box borderStyle="round" borderColor="green" paddingX={1}>
                <Text color="green" bold>{'> '} </Text>
                {/*<TextInput
                    key={inputKey} // 🌟 绑定动态 key
                    value={query}
                    onChange={setQuery}
                    onSubmit={isCommandMode ? undefined : handleSubmit}
                    placeholder={mode === 'model-selection' ? "输入模型名称筛选，按 Tab 补全" : "今天想问点什么? (输入 / 查看命令)"}
                />*/}
                <MultilineInput
                    key={inputKey}
                    value={query}
                    onChange={setQuery}
                    onSubmit={isCommandMode ? undefined : handleSubmit}
                    placeholder={
                        mode === 'model-selection'
                            ? "输入模型名称筛选，按 Tab 补全"
                            : "今天想问点什么? (回车发送，Ctrl+N 换行，支持大段文本粘贴)"
                    }
                />
            </Box>

            {isCommandMode && (
                <Box
                    borderStyle="single"
                    borderColor="yellow"
                    paddingX={1}
                    flexDirection="column"
                >
                    <Box marginBottom={1}>
                        <Text color="yellow" bold>
                            {mode === 'model-selection' ? '选择或搜索模型：' : '按上下键选择命令，回车执行：'}
                        </Text>
                    </Box>
                    <SelectInput
                        items={displayCommands}
                        onSelect={handleCommandSelect}
                    />
                </Box>
            )}
        </Box>
    );
};