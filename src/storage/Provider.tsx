import React, { createContext, useContext, useRef } from 'react';
import { useStore } from 'zustand';
import { createConfigStore } from './configStore';
import { createSessionStore } from './sessionStore';
import { createRuntimeStore } from './runtimeStore';

type ConfigStore = ReturnType<typeof createConfigStore>;
type SessionStore = ReturnType<typeof createSessionStore>;
type RuntimeStore = ReturnType<typeof createRuntimeStore>;

const ConfigContext = createContext<ConfigStore | null>(null);
const SessionContext = createContext<SessionStore | null>(null);
const RuntimeContext = createContext<RuntimeStore | null>(null);

export const StoreProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const configRef = useRef<ConfigStore>(null);
    const sessionRef = useRef<SessionStore>(null);
    const runtimeRef = useRef<RuntimeStore>(null);

    // 保证 Store 实例在整个 CLI 生命周期内只创建一次
    if (!configRef.current) configRef.current = createConfigStore();
    if (!sessionRef.current) sessionRef.current = createSessionStore();
    if (!runtimeRef.current) runtimeRef.current = createRuntimeStore();

    return (
        <ConfigContext.Provider value={configRef.current}>
            <SessionContext.Provider value={sessionRef.current}>
                <RuntimeContext.Provider value={runtimeRef.current}>
                    {children}
                </RuntimeContext.Provider>
            </SessionContext.Provider>
        </ConfigContext.Provider>
    );
};

export function useConfigStore<T>(selector: (state: ReturnType<ConfigStore['getState']>) => T): T {
    const store = useContext(ConfigContext);
    if (!store) throw new Error('Missing StoreProvider');
    return useStore(store, selector);
}

export function useSessionStore<T>(selector: (state: ReturnType<SessionStore['getState']>) => T): T {
    const store = useContext(SessionContext);
    if (!store) throw new Error('Missing StoreProvider');
    return useStore(store, selector);
}

export function useRuntimeStore<T>(selector: (state: ReturnType<RuntimeStore['getState']>) => T): T {
    const store = useContext(RuntimeContext);
    if (!store) throw new Error('Missing StoreProvider');
    return useStore(store, selector);
}