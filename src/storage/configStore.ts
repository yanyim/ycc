// store/configStore.ts
import {createStore} from 'zustand';
import {persist, createJSONStorage} from 'zustand/middleware';
import {createFileStorage} from './storage'; // 指向 ~/.ycc/config.json

export interface ConfigState {
    modelConfig: { provider: string; model: string };
    setModelConfig: (config: { provider: string; model: string }) => void;
    _hasHydrated: boolean;
    setHasHydrated: (state: boolean) => void;
}

export const createConfigStore = () => {
    return createStore<ConfigState>()(
        persist(
            (set) => ({
                modelConfig: {provider: 'openai', model: 'gpt-3.5-turbo'},
                setModelConfig: (config) => set({modelConfig: config}),
                _hasHydrated: false,
                setHasHydrated: (state) => set({_hasHydrated: state}),
            }),
            {
                name: 'global-config', // 这个 name 是 JSON 内部的 key
                storage: createJSONStorage(() => createFileStorage('config.json')),
                onRehydrateStorage: () => (state) => {
                    if (state) state.setHasHydrated(true);
                },
            }
        )
    );
};