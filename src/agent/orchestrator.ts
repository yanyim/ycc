// src/agent/orchestrator.ts
import { END, START, StateGraph } from "@langchain/langgraph";
import { AIMessage, HumanMessage, SystemMessage } from "@langchain/core/messages";
import { z } from "zod";
import { GlobalStateAnnotation } from "./state";
import { CODER_AGENT, EXPLORE_AGENT, VERIFIER_AGENT } from "./config/agents";
import { CodeToolRegistry } from "./tools/registry";
import { createWorkerGraph } from "./graphs/workerGraph";
import type { AgentEvent } from "./types/events";

import { getSupervisorSystemPrompt } from "./prompts/supervisor";

export class CodeAgentOrchestrator {
    private graph: any; // 编译后的主图
    private llmModel: any;
    private toolRegistry: CodeToolRegistry;
    private delayMs: number;
    private workspacePath: string;

    constructor(llmModel: any, workspacePath: string = process.cwd(), delayMs: number = 0) {
        this.llmModel = llmModel;
        this.toolRegistry = new CodeToolRegistry(workspacePath);
        this.delayMs = delayMs;
        this.workspacePath = workspacePath
        this.buildGlobalGraph();
    }

    /**
     * 核心组装：构建大老板与打工人的通信网络
     */
    private buildGlobalGraph() {
        // 1. 初始化并编译所有子图 (Sub-Graphs)
        const exploreSubGraph = createWorkerGraph(
            EXPLORE_AGENT,
            this.toolRegistry.resolveToolsForAgent(EXPLORE_AGENT),
            this.llmModel,
            this.workspacePath // 🌟 传入构造函数里保存的路径
        );
        const coderSubGraph = createWorkerGraph(
            CODER_AGENT,
            this.toolRegistry.resolveToolsForAgent(CODER_AGENT),
            this.llmModel,
            this.workspacePath // 🌟 传入构造函数里保存的路径
        );
        const verifierSubGraph = createWorkerGraph(
            VERIFIER_AGENT,
            this.toolRegistry.resolveToolsForAgent(VERIFIER_AGENT),
            this.llmModel,
            this.workspacePath // 🌟 传入构造函数里保存的路径
        );

        // 2. 定义大老板节点 (Supervisor Node)
        const supervisorNode = async (state: typeof GlobalStateAnnotation.State, config: any) => {

            // 🌟 修复点 1：将 reasoning 设为 optional()，防止模型“偷懒”导致解析器崩溃
            const routingSchema = z.object({
                reasoning: z.string().optional().describe("你的内部思考过程，判断当前处于什么阶段。"),
                message: z.string().describe("如果派发任务，写给下级智能体的具体工作指令；如果只是打招呼或闲聊，写给用户的直接回复。"),
                nextWorker: z.enum(["explorer", "coder", "verifier", "FINISH"]).describe("下一个唤醒的智能体。如果是闲聊、或者任务已完成需要等待用户输入，必须输出 FINISH"),
            });

            const supervisorModel = this.llmModel.withStructuredOutput(routingSchema, { name: "route_task" });

            // 🌟 动态获取干净的 Prompt
            const systemPrompt = getSupervisorSystemPrompt();

            if (this.delayMs > 0) {
                await new Promise(resolve => setTimeout(resolve, this.delayMs));
            }

            const response = await supervisorModel.invoke([
                new SystemMessage(systemPrompt),
                ...state.messages
            ], config);

            return {
                nextWorker: response.nextWorker,
                // 这里我们依然只把 message 放入流中供后续使用
                messages: [new AIMessage({ content: response.message, name: "supervisor" })]
            };
        };

        // 3. 高阶工厂函数：包装子图
        const createWorkerWrapper = (subGraph: any, workerName: string) => {
            return async (state: typeof GlobalStateAnnotation.State, config: any) => {
                const lastMessage = state.messages[state.messages.length - 1];
                const currentInstruction = lastMessage ? String(lastMessage.content) : "请继续执行任务";

                try {
                    // 🌟 核心修复：注入 recursionLimit，强制限制子图的最大循环次数
                    const subGraphResult = await subGraph.invoke({
                        currentTask: currentInstruction,
                        inheritedHeavyContext: state.heavyContext,
                        messages: [],
                        extractedResult: ""
                    }, {
                        ...config,
                        recursionLimit: 8 // 最多允许 Agent -> Tool 往返 8 次，超过直接抛出异常！
                    });

                    const resultText = subGraphResult.extractedResult || "子任务执行结束，但未提取出有效的文本结论。";

                    return {
                        messages: [new AIMessage({
                            content: `[${workerName} 汇报]: ${resultText}`,
                            name: workerName
                        })]
                    };

                } catch (error: any) {
                    // 🌟 核心修复：捕获 LangGraph 的递归超限异常，优雅退出
                    if (error.name === 'GraphRecursionError' || error.message?.includes('recursion')) {
                        return {
                            messages: [new AIMessage({
                                content: `[${workerName} 异常退出]: 任务执行超过了最大允许步数 (可能发生了工具调用死循环)。已强制终止。`,
                                name: workerName
                            })]
                        };
                    }
                    // 其他异常正常抛出
                    throw error;
                }
            };
        };

        // 4 & 5. 改为严格的连续链式调用！
        this.graph = new StateGraph(GlobalStateAnnotation)
            .addNode("supervisor", supervisorNode)
            .addNode("explorer", createWorkerWrapper(exploreSubGraph, "ExploreAgent"))
            .addNode("coder", createWorkerWrapper(coderSubGraph, "CoderAgent"))
            .addNode("verifier", createWorkerWrapper(verifierSubGraph, "VerifierAgent"))
            .addEdge(START, "supervisor")
            .addConditionalEdges(
                "supervisor",
                // 使用 as 强制收窄类型，让 TS 确认路由只会去这几个安全的终点
                (state) => state.nextWorker === "FINISH" ? END : state.nextWorker as "explorer" | "coder" | "verifier"
            )
            .addEdge("explorer", "supervisor")
            .addEdge("coder", "supervisor")
            .addEdge("verifier", "supervisor")
            .compile();
    }

    /**
     * 主入口：供 UI 层调用的事件流生成器
     */
    public async* executeTask(chatHistory: {
        role: string,
        content: string
    }[]): AsyncGenerator<AgentEvent, void, unknown> {
        const langChainMessages = chatHistory.map(msg =>
            msg.role === 'user' ? new HumanMessage(msg.content) :
                msg.role === 'system' ? new SystemMessage(msg.content) :
                    new AIMessage(msg.content)
        );

        const initialState = {
            messages: langChainMessages,
            taskStatus: 'running' as const
        };

        // 🌟 终极防死循环保护：限制大老板（Supervisor）的递归调度次数
        const stream = await this.graph.streamEvents(initialState, {
            version: "v2",
            recursionLimit: 10 // 如果老板反复派发任务超过 10 次还不说 FINISH，强制熔断！
        });

        try {
            let finalResult = "";
            let currentTopNode = "";

            for await (const event of stream) {
                const { event: eventType, name, data } = event;

                switch (eventType) {
                    case "on_chat_model_stream":
                        // 模型正在打字输出
                        if (currentTopNode !== 'supervisor' && data?.chunk?.content) {
                            yield { type: 'message_chunk', content: data.chunk.content };
                        }
                        break;

                    case "on_tool_start":
                        yield { type: 'tool_start', toolName: name, args: data.input };
                        break;

                    case "on_tool_end":
                        yield { type: 'tool_end', toolName: name, result: "执行成功 (截断显示...)" };
                        break;

                    case "on_chain_start":
                        if (['supervisor', 'explorer', 'coder', 'verifier'].includes(name)) {
                            currentTopNode = name;
                            yield { type: 'agent_start', agentName: name, description: `开始执行子任务...` };
                        }
                        break;

                    case "on_chain_end":
                        // 拦截节点的结束事件，提取它们汇报的消息作为最终结果
                        if (['supervisor', 'explorer', 'coder', 'verifier'].includes(name)) {
                            if (data.output?.messages && data.output.messages.length > 0) {
                                const msgs = data.output.messages;
                                finalResult = msgs[msgs.length - 1].content;
                            }
                        }
                        break;
                }
            }

            // 图执行完毕，直接 yield 我们收集到的最后一条消息
            yield { type: 'task_complete', finalResult };

        } catch (error: any) {
            // 捕获可能的主图 recursionLimit 异常并反馈给前端
            if (error.name === 'GraphRecursionError' || error.message?.includes('recursion')) {
                yield { type: 'error', message: "系统检测到死循环，已强制终止任务。" };
            } else {
                yield { type: 'error', message: error.message };
            }
        }
    }
}