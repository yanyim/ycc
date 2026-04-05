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

                        // 🌟 修复冲突：hydration 完成后如果发现拿不到有效配置 (空数组)
                        // 则强制触发 initImpl 的逻辑获取并初始化最新配置
                        if (!state.models || state.models.length === 0) {
                            try {
                                const { state: initState } = await coreInitLogic();
                                // 将生成的正确配置同步到当前的内存 Store 中
                                state.setModels(initState.models);
                                state.setCurrentModel(initState.currentModel);
                            } catch (err) {
                                console.error('自动初始化备用配置失败:', err);
                            }
                        }
                    }
                },
            }
        )
    );
};