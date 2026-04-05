// src/components/MultilineInput.tsx
import React, { useState, useRef } from 'react';
import { Text, useInput } from 'ink';

interface MultilineInputProps {
    value: string;
    onChange: (value: string) => void;
    onSubmit?: (value: string) => void;
    placeholder?: string;
}

export const MultilineInput: React.FC<MultilineInputProps> = ({
                                                                  value,
                                                                  onChange,
                                                                  onSubmit,
                                                                  placeholder = ''
                                                              }) => {
    const [cursorOffset, setCursorOffset] = useState(value.length);
    const lastInputTime = useRef(Date.now());
    const isPasting = useRef(false);

    // 🌟 修复问题 2: 移除 useEffect 强行截断的竞争条件，使用动态安全偏移
    // 这样既允许光标状态超前，又保证在 value 尚未同步时不会越界截取报错
    const safeOffset = Math.min(cursorOffset, Math.max(0, value.length));

    const getCursorPos = (text: string, offset: number) => {
        const lines = text.slice(0, offset).split('\n');
        const lastLine = lines[lines.length - 1] ?? '';
        return { row: lines.length - 1, col: lastLine.length };
    };

    const getOffsetFromPos = (text: string, row: number, col: number) => {
        const lines = text.split('\n');
        const targetRow = Math.max(0, Math.min(row, lines.length - 1));
        const targetLine = lines[targetRow] ?? '';
        const targetCol = Math.max(0, Math.min(col, targetLine.length));

        let offset = 0;
        for (let i = 0; i < targetRow; i++) {
            const currentLine = lines[i] ?? '';
            offset += currentLine.length + 1;
        }
        return offset + targetCol;
    };

    useInput((input, key) => {
        const now = Date.now();
        if (now - lastInputTime.current < 15) {
            isPasting.current = true;
        } else {
            isPasting.current = false;
        }
        lastInputTime.current = now;

        // 处理回车键
        if (key.return) {
            if (isPasting.current) {
                const newVal = value.slice(0, safeOffset) + '\n' + value.slice(safeOffset);
                onChange(newVal);
                setCursorOffset(safeOffset + 1);
                return;
            }

            if (onSubmit) {
                onSubmit(value);
            }
            return;
        }

        // 🌟 Ctrl + N 换行处理
        if (key.ctrl && input === 'n') {
            const newVal = value.slice(0, safeOffset) + '\n' + value.slice(safeOffset);
            onChange(newVal);
            setCursorOffset(safeOffset + 1); // 安全推进光标
            return;
        }

        if (key.backspace || key.delete) {
            if (safeOffset > 0) {
                const newVal = value.slice(0, safeOffset - 1) + value.slice(safeOffset);
                onChange(newVal);
                setCursorOffset(safeOffset - 1);
            }
            return;
        }

        // 方向键移动逻辑
        if (key.leftArrow) {
            setCursorOffset(Math.max(0, safeOffset - 1));
            return;
        }
        if (key.rightArrow) {
            setCursorOffset(Math.min(value.length, safeOffset + 1));
            return;
        }
        if (key.upArrow) {
            const pos = getCursorPos(value, safeOffset);
            setCursorOffset(getOffsetFromPos(value, pos.row - 1, pos.col));
            return;
        }
        if (key.downArrow) {
            const pos = getCursorPos(value, safeOffset);
            setCursorOffset(getOffsetFromPos(value, pos.row + 1, pos.col));
            return;
        }

        // 普通输入
        if (input) {
            const newVal = value.slice(0, safeOffset) + input + value.slice(safeOffset);
            onChange(newVal);
            setCursorOffset(safeOffset + input.length);
        }
    });

    // 渲染排版计算
    const isPlaceholder = value.length === 0;
    const renderText = isPlaceholder ? placeholder : value;
    const activeOffset = isPlaceholder ? 0 : safeOffset;

    const beforeCursor = renderText.slice(0, activeOffset);
    const cursorChar = renderText.slice(activeOffset, activeOffset + 1);
    const afterCursor = renderText.slice(activeOffset + 1);

    let cursorElement;
    if (!cursorChar) {
        cursorElement = <Text inverse> </Text>;
    } else if (cursorChar === '\n') {
        // 光标刚好停在换行符上时的特殊渲染
        cursorElement = <Text><Text inverse> </Text>{'\n'}</Text>;
    } else {
        cursorElement = <Text inverse>{cursorChar}</Text>;
    }

    // 🌟 修复问题 3: 必须使用 <Text> 包裹一切，否则 Box 的 flex-col 会将文本垂直拆分成三行导致乱码！
    return (
        <Text>
            <Text dimColor={isPlaceholder}>{beforeCursor}</Text>
            {cursorElement}
            <Text dimColor={isPlaceholder}>{afterCursor}</Text>
        </Text>
    );
};