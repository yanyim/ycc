// src/hooks/useTerminalResize.ts
import { useState, useEffect } from 'react';

export function useTerminalResize(debounceMs = 500) {
    const [isResizing, setIsResizing] = useState(false);
    // 每次缩放结束后，改变这个计数器，用来强制刷新组件 Key
    const [resizeCount, setResizeCount] = useState(0);

    useEffect(() => {
        if (!process.stdout.isTTY) return;

        let timer: ReturnType<typeof setTimeout>;

        const handleResize = () => {
            setIsResizing(true);
            clearTimeout(timer);

            // 等待用户松开鼠标 (500ms 没有新事件)
            timer = setTimeout(() => {
                // 🌟 1. 拖拽停止后，第一时间发送 ANSI 原生指令暴力清屏
                // \x1b[2J : 清空当前可视屏幕的所有乱码残影
                // \x1b[H  : 将光标强行归位到终端左上角 (0,0) 坐标
                process.stdout.write('\x1b[2J\x1b[H');

                // 🌟 2. 稍微延迟 50ms，确保清屏指令已被终端消化，再通知 React 重新渲染
                setTimeout(() => {
                    setResizeCount(c => c + 1);
                    setIsResizing(false);
                }, 50);

            }, debounceMs);
        };

        process.stdout.on('resize', handleResize);

        return () => {
            process.stdout.off('resize', handleResize);
            clearTimeout(timer);
        };
    }, [debounceMs]);

    return { isResizing, resizeCount };
}