// src/App.tsx
import React, { useEffect, useMemo } from 'react';
import { Box } from 'ink';
import { createModel } from './utils/ai';
import { Welcome } from './components/Welcome';
import { ChatArea } from './components/ChatArea';
import { CommandInput } from './components/CommandInput';
import { StatusBar } from './components/StatusBar'; // 🌟 引入状态栏
import { commandRegistry, commandList } from './commands';
import type { Message } from './types';
import { CodeAgentOrchestrator } from './agent/orchestrator'; // 🌟 引入智能体大脑

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

    // 🌟 引入 Agent 状态
    const agentStatus = useRuntimeStore(state => state.agentStatus);
    const setAgentStatus = useRuntimeStore(state => state.setAgentStatus);

    // 3. Config Store (读取配置)
    const models = useConfigStore(state => state.models);
    const currentModelName = useConfigStore(state => state.currentModel);
    const setCurrentModel = useConfigStore(state => state.setCurrentModel);

    // 🌟 动态生成 LangChain 模型实例
    const activeModel = useMemo(() => {
        const modelInfo = models.find(m => m.model === currentModelName);
        const provider = modelInfo?.provider || 'openai';
        // 这里的 createModel 已经是我们改造过、返回 ChatOpenAI 实例的方法了
        return createModel(provider, currentModelName || 'gpt-3.5-turbo');
    }, [models, currentModelName]);

    // 🌟 实例化智能体编排器 (当模型变化时重建)
    const orchestrator = useMemo(() => {
        return new CodeAgentOrchestrator(activeModel, process.cwd());
    }, [activeModel]);

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

        // --- 🤖 Agent 编排流处理 ---
        setIsGenerating(true);
        setCurrentStream('');

        // 🌟 定义局部变量跟踪当前活跃的 Agent，完美解决 TS 类型与闭包陷阱
        let currentAgentName = 'Supervisor';
        setAgentStatus({ agentName: currentAgentName, statusText: '正在分析任务边界...' });

        // 固化用户消息
        await addMessage(userMsg);
        const currentContext = [...messages, userMsg];

        try {
            let fullText = '';

            // 🌟 监听图编排器抛出的高阶事件流
            for await (const event of orchestrator.executeTask(currentContext)) {

                if (event.type === 'agent_start') {
                    // 更新局部跟踪变量
                    currentAgentName = event.agentName;
                    setAgentStatus({ agentName: currentAgentName, statusText: '思考规划中...' });
                }
                else if (event.type === 'tool_start') {
                    // 提取工具参数，截断显示防止终端被刷屏
                    const argsSummary = JSON.stringify(event.args).substring(0, 30) + '...';
                    setAgentStatus({
                        agentName: currentAgentName,
                        statusText: `调用工具 [${event.toolName}] ${argsSummary}`
                    });
                }
                else if (event.type === 'tool_end') {
                    setAgentStatus({
                        agentName: currentAgentName,
                        statusText: '分析工具返回结果...'
                    });
                }
                else if (event.type === 'message_chunk') {
                    // 某些直接向用户输出的流式文本（通常是在最后汇报阶段抛出）
                    fullText += event.content;
                    setCurrentStream(fullText);
                }
                else if (event.type === 'task_complete') {
                    // 任务彻底结束，提取最终大老板或子任务汇总的结论
                    if (!fullText && event.finalResult) {
                        fullText = event.finalResult;
                    }
                }
                else if (event.type === 'error') {
                    throw new Error(event.message);
                }
            }

            // 流程结束，清理状态并落盘
            setAgentStatus(null);
            setCurrentStream('');
            await addMessage({ id: crypto.randomUUID(), role: 'ai', content: fullText || '任务执行完毕，未返回特定输出。' });

        } catch (error: any) {
            setAgentStatus(null);
            setCurrentStream('');
            await addMessage({ id: crypto.randomUUID(), role: 'system', content: `[任务异常崩溃]: ${error.message}` });
        } finally {
            setIsGenerating(false);
        }
    };

    return (
        <Box flexDirection="column">
            {messages.length === 0 && <Welcome />}

            <ChatArea history={messages} currentStream={currentStream} />

            {/* 🌟 插入状态栏：夹在对话与输入框中间 */}
            <StatusBar status={agentStatus} />

            <CommandInput onSubmit={handleInputSubmit} />
        </Box>
    );
};