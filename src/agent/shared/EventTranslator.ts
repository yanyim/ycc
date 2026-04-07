// src/agent/shared/EventTranslator.ts
import type { AgentEvent } from "../types/events";

export class GraphEventTranslator {
    // 状态机变量：用于跨事件汇总数据
    private textBuffer: string = '';
    private isBufferingJson: boolean = false;
    private currentAgent: string = '';

    /**
     * 将 LangGraph 的原始事件转换为前端友好的 AgentEvent
     * 采用生成器 (Generator) 模式，可以一次接收一个事件，但视情况挂起或吐出多个事件
     */
    public *translate(rawEvent: any): IterableIterator<AgentEvent> {
        const { event, name, data, metadata } = rawEvent;
        // 提取真实的节点名称
        const nodeName = metadata?.langgraph_node || name;

        // 1. 智能体节点切换 (Agent Switch)
        if (event === "on_chain_start") {
            if (this.isValidAgentNode(nodeName)) {
                this.currentAgent = nodeName;
                this.textBuffer = '';
                this.isBufferingJson = false;
                yield { type: 'agent_start', agentName: nodeName, description: '思考与执行中...' };
            }
        }

        // 2. 工具调用 (Tool Execution)
        else if (event === "on_tool_start") {
            yield { type: 'tool_start', toolName: name, args: data?.input };
        }
        else if (event === "on_tool_end") {
            const resultStr = typeof data?.output === 'string'
                ? data.output
                : JSON.stringify(data?.output);
            yield { type: 'tool_end', toolName: name, result: resultStr };
        }

        // 3. 模型流式输出与 JSON 智能拦截 (Streaming & Buffering)
        else if (event === "on_chat_model_stream") {
            const chunk = data?.chunk?.content;
            if (chunk && typeof chunk === "string") {
                this.textBuffer += chunk;
                const trimmed = this.textBuffer.trim();

                // 嗅探：如果发现开头是 '{' 或 '```json'，进入 JSON 缓冲模式
                if (!this.isBufferingJson && (trimmed.startsWith('{') || trimmed.startsWith('```json'))) {
                    this.isBufferingJson = true;
                }

                // 只有在非缓冲模式下，才把文本流式抛给前端
                if (!this.isBufferingJson) {
                    yield { type: 'message_chunk', content: chunk };
                }
            }
        }

        // 4. 模型输出完毕：处理缓冲的 JSON
        else if (event === "on_chat_model_end") {
            if (this.isBufferingJson) {
                const finalStr = this.extractAndParseJson(this.textBuffer);
                // 将解析后的纯净文本一次性抛给前端
                if (finalStr) {
                    yield { type: 'message_chunk', content: finalStr };
                }

                // 重置状态
                this.isBufferingJson = false;
                this.textBuffer = '';
            }
        }

        // 5. 异常捕获
        else if (event === "error") {
            yield { type: 'error', message: data?.error?.message || '未知异常' };
        }

        // 6. 任务彻底结束
        else if (event === "on_chain_end") {
            // 识别根图 StateGraph 运行结束
            if (name === "StateGraph" && !metadata?.langgraph_node) {
                yield { type: 'task_complete', finalResult: '' };
            }
        }
    }

    /**
     * 判断是否是真实的 Agent 节点 (过滤掉系统虚拟节点和工具节点)
     * 这个规则同时适用于 Coding 团队和 Batch-Edit 团队！
     */
    private isValidAgentNode(nodeName: string): boolean {
        if (!nodeName || nodeName === "__start__") return false;
        if (nodeName.toLowerCase().includes("tools")) return false; // 拦截各类工具节点
        if (nodeName.includes("LangGraph") || nodeName.startsWith("StateGraph")) return false;
        return true;
    }

    /**
     * 健壮的 JSON 解析逻辑
     */
    private extractAndParseJson(rawText: string): string {
        let cleanStr = rawText.trim();
        if (cleanStr.startsWith('```json')) {
            cleanStr = cleanStr.replace(/^```json\n?/, '').replace(/```$/, '').trim();
        }

        try {
            const parsed = JSON.parse(cleanStr);
            // 针对 Supervisor 的特定格式提取 message，如果其他节点有其他格式可扩展
            if (parsed.message) {
                return String(parsed.message);
            }
            return cleanStr; // 解析成功但没有 message 字段，返回完整 JSON 字符串
        } catch (e) {
            // 解析失败，说明 AI 幻觉了，原样返回兜底
            return rawText;
        }
    }
}