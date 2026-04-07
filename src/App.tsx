// src/App.tsx
import React, {useEffect, useMemo} from 'react';
import {Box, Static} from 'ink';
import {createModel} from './utils/ai';
import {Welcome} from './components/Welcome';
import {ChatArea} from './components/ChatArea';
import {CommandInput} from './components/CommandInput';
import {StatusBar} from './components/StatusBar';
import {commandList, commandRegistry} from './commands';
import type {Message} from './types';
import {TeamOrchestrator} from './agent/orchestrator';
import {DEFAULT_TEAM, TEAM_REGISTRY} from './agent/config/teams';
import {useConfigStore, useRuntimeStore, useSessionStore} from './storage';
import {useTerminalResize} from "./hooks/useTerminalResize";

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
    const setModels = useConfigStore(state => state.setModels);
    const delay = useConfigStore(state => state.delay);

    const { isResizing, resizeCount } = useTerminalResize(500);

    useEffect(() => {
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

    // 1. 获取持久化的 Team ID
    const currentTeamId = useConfigStore(state => state.currentTeamId);


// 2. 映射为具体的团队配置
    const activeTeamDef = useMemo(() => {
        return TEAM_REGISTRY.get(currentTeamId) || DEFAULT_TEAM;
    }, [currentTeamId]);

// 3. 实例化大模型
    const activeModel = useMemo(() => {
        const modelInfo = models.find(m => m.model === currentModelName);
        const provider = modelInfo?.provider || 'openai';
        return createModel(provider, currentModelName || 'gpt-3.5-turbo');
    }, [models, currentModelName]);

// 🌟 4. 实例化团队统筹者 (图引擎)
    const orchestrator = useMemo(() => {
        return new TeamOrchestrator(
            activeTeamDef,
            activeModel,
            process.cwd(),
            delay
        );
    }, [activeTeamDef, activeModel, delay]);

    const handleInputSubmit = async (text: string) => {
        if (isGenerating) return;

        // 🌟 我们在 Message 中增加一个隐式标记 `isTrace`，用于区分这是真实对话还是前端 UI 的追踪日志
        const userMsg = {id: crypto.randomUUID(), role: 'user', content: text} as Message;

        if (text.startsWith('/')) {
            const [cmdNameWithSlash, ...args] = text.trim().split(' ');
            const cmdName = (cmdNameWithSlash || '').slice(1);
            const command = commandRegistry.get(cmdName);

            if (command) {
                try {
                    await command.execute({
                        args, options: {}, messages, models, addMessage, clearMessages,
                        setMode, setAvailableCommands, setCurrentModel, setModels
                    });
                } catch (error: any) {
                    await addMessage({
                        id: crypto.randomUUID(),
                        role: 'system',
                        content: `[命令执行失败]: ${error.message}`
                    } as Message);
                }
            } else {
                await addMessage(userMsg);
                await addMessage({id: crypto.randomUUID(), role: 'system', content: `未知命令: ${cmdName}`} as Message);
            }
            return;
        }

        setIsGenerating(true);
        setCurrentStream('');

        let currentAgentName = 'Supervisor';
        setAgentStatus({agentName: currentAgentName, statusText: '正在分析任务边界...'});

        await addMessage(userMsg);

        // 🌟 核心过滤：提取发给 LLM 的上下文时，彻底剔除掉我们用于 UI 展示的 Tool Traces 日志！
        const currentContext = [...messages, userMsg].filter(
            (msg: any) => !msg.isTrace
        );

        try {
            let fullText = ''; // 前端只负责管理要在屏幕上打出来的这坨字

            for await (const event of orchestrator.executeTask(currentContext)) {

                if (event.type === 'agent_start') {
                    // 1. 如果上个角色说了话，保存进历史
                    if (fullText.trim()) {
                        await addMessage({id: crypto.randomUUID(), role: 'ai', content: fullText} as Message);
                    }

                    // 2. 清空屏幕当前输入，准备迎接新角色
                    fullText = '';
                    setCurrentStream('');

                    // 3. UI 状态更新
                    currentAgentName = event.agentName;
                    setAgentStatus({agentName: currentAgentName, statusText: '思考规划中...'});

                    if (currentAgentName !== 'supervisor') {
                        await addMessage({
                            id: crypto.randomUUID(), role: 'system',
                            content: `👑 [调度]: 唤醒 ${currentAgentName.toUpperCase()} 接管任务...`,
                            isTrace: true
                        } as any);
                    }
                }
                else if (event.type === 'tool_start') {
                    setAgentStatus({
                        agentName: currentAgentName,
                        statusText: `执行工具 [${event.toolName}] ${JSON.stringify(event.args).substring(0, 30)}...`
                    });
                }
                else if (event.type === 'tool_end') {
                    await addMessage({
                        id: crypto.randomUUID(), role: 'system',
                        content: `⚙️ [${currentAgentName.toUpperCase()}] call: ${event.toolName} [✓ Success]`,
                        isTrace: true
                    } as any);
                    setAgentStatus({agentName: currentAgentName, statusText: '分析工具返回结果...'});
                }
                else if (event.type === 'message_chunk') {
                    // 🌟 极致精简！前端再也不用判断是不是 JSON，只要收到 chunk，无脑拼接渲染就对了！
                    fullText += event.content;
                    setCurrentStream(fullText);
                }
                else if (event.type === 'task_complete') {
                    if (!fullText && event.finalResult) fullText = event.finalResult;
                }
                else if (event.type === 'error') {
                    throw new Error(event.message);
                }
            }

            setAgentStatus(null);
            setCurrentStream('');

            // 任务结束，把最后一句话存进历史
            if (fullText.trim()) {
                await addMessage({id: crypto.randomUUID(), role: 'ai', content: fullText.trim()} as Message);
            }

        } catch (error: any) {
            setAgentStatus(null);
            setCurrentStream('');
            await addMessage({
                id: crypto.randomUUID(),
                role: 'system',
                content: `[任务异常崩溃]: ${error.message}`
            } as Message);
        } finally {
            setIsGenerating(false);
        }
    };

    console.info('messages',messages.length)

    return (
        <Box flexDirection="column">
            {/* ChatArea 会自动渲染 messages 里的真实对话和我们刚刚塞进去的追踪日志 */}
            <ChatArea key={`chat-area-${resizeCount}`} history={messages} currentStream={currentStream}/>

            <StatusBar status={agentStatus}/>

            <CommandInput onSubmit={handleInputSubmit}/>
        </Box>
    );
};