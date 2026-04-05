// src/storage/configStore.ts
import { createStore } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import { createFileStorage } from './storage';
import { coreInitLogic } from '../commands/init/initImpl'; // 🌟 引入抽离的共享逻辑

export interface ModelInfo {
    provider: string;
    model: string;
}

export interface ConfigState {
    models: ModelInfo[];
    setModels: (models: ModelInfo[]) => void;
    currentModel: string;
    setCurrentModel: (model: string) => void;
    _hasHydrated: boolean;
    setHasHydrated: (state: boolean) => void;
}

export const createConfigStore = () => {
    return createStore<ConfigState>()(
        persist(
            (set) => ({
                models: [],
                setModels: (models) => set({ models }),
                currentModel: '',
                setCurrentModel: (model) => set({ currentModel: model }),
                _hasHydrated: false,
                setHasHydrated: (state) => set({ _hasHydrated: state }),
            }),
            {
                name: 'global-config', // json 内部包装键名，Zustand 不会使用它做文件名
                storage: createJSONStorage(() => createFileStorage('config.json')),
                onRehydrateStorage: () => async (state) => {
                    if (state) {
                        state.setHasHydrated(true);

                        // 当 Zustand 从文件里读出来发现没有 models 时（比如文件被删了、初次运行）
                        if (!state.models || state.models.length === 0) {
                            // 拿到默认数据
                            const { state: initState } = await coreInitLogic();

                            // 更新状态，Zustand 会自动把它们序列化并保存到 config.json 里
                            state.setModels(initState.models);
                            state.setCurrentModel(initState.currentModel);
                        }
                    }
                },
            }
        )
    );
};