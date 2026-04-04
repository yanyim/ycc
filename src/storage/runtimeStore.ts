// src/store/runtimeStore.ts
import { createStore } from 'zustand';

export interface RuntimeState {
    isGenerating: boolean;
    setIsGenerating: (status: boolean) => void;

    // 例如：控制命令面板的显隐
    showCommandPanel: boolean;
    setShowCommandPanel: (show: boolean) => void;

    // 当前正在流式输出的文本
    currentStream: string;
    setCurrentStream: (text: string) => void;
}

export const createRuntimeStore = () => {
    return createStore<RuntimeState>()((set) => ({
        isGenerating: false,
        setIsGenerating: (status) => set({ isGenerating: status }),

        showCommandPanel: false,
        setShowCommandPanel: (show) => set({ showCommandPanel: show }),

        currentStream: '',
        setCurrentStream: (text) => set({ currentStream: text }),
    }));
};