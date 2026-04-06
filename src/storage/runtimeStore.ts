// src/store/runtimeStore.ts
import type {StoreApi, UseBoundStore} from 'zustand';
import {create} from 'zustand';

export interface RuntimeState {
    isGenerating: boolean;
    setIsGenerating: (status: boolean) => void;

    agentStatus: { agentName: string; statusText: string } | null;
    setAgentStatus: (status: { agentName: string; statusText: string } | null) => void;

    // 例如：控制命令面板的显隐
    showCommandPanel: boolean;
    setShowCommandPanel: (show: boolean) => void;

    // 当前正在流式输出的文本
    currentStream: string;
    setCurrentStream: (text: string) => void;

    // 命令列表 (动态变化)
    availableCommands: { label: string; value: string }[];
    setAvailableCommands: (commands: { label: string; value: string }[]) => void;

    // 模式 (普通命令 vs 模型选择)
    mode: 'normal' | 'model-selection' | 'agent-selection';
    setMode: (mode: 'normal' | 'model-selection' | 'agent-selection') => void;
}


export const useRuntimeStore: UseBoundStore<StoreApi<RuntimeState>> = create<RuntimeState>((set) => ({
    isGenerating: false,
    setIsGenerating: (status) => set({isGenerating: status}),

    agentStatus: null,
    setAgentStatus: (status) => set({agentStatus: status}),

    showCommandPanel: false,
    setShowCommandPanel: (show) => set({showCommandPanel: show}),

    currentStream: '',
    setCurrentStream: (text) => set({currentStream: text}),

    availableCommands: [],
    setAvailableCommands: (commands) => set({availableCommands: commands}),

    mode: 'normal',
    setMode: (mode) => set({mode: mode}),

}))
