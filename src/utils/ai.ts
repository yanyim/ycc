// src/utils/ai.ts
import { ChatOpenAI } from "@langchain/openai";

export function createModel(provider: string, model: string) {
    // 无论是 OpenAI 还是 OpenRouter，都使用兼容 OpenAI 格式的接口
    return new ChatOpenAI({
        configuration: {
            baseURL: process.env[`${provider.toUpperCase()}_AI_API_URL`] || 'https://openrouter.ai/api/v1',
            apiKey: process.env[`${provider.toUpperCase()}_AI_API_KEY`] || process.env.OPENAI_API_KEY,
        },
        modelName: model,
        temperature: 0.2, // Agent 场景建议调低温度以保证工具调用的稳定性
        maxRetries: 3,
    });
}