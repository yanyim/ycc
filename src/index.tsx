#!/usr/bin/env bun
import React from 'react';
import { render } from 'ink';
import { App } from './App';
import { StoreProvider } from './storage'; // 🌟 引入 Provider

render(
    <StoreProvider>
        <App />
    </StoreProvider>
);