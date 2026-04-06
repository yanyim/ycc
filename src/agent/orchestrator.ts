// src/agent/orchestrator.ts
import {END, START, StateGraph} from "@langchain/langgraph";
import {AIMessage, HumanMessage, SystemMessage} from "@langchain/core/messages";
import {z} from "zod";
import {GlobalStateAnnotation} from "./state";
import {CodeToolRegistry} from "./tools/registry";
import {createWorkerGraph} from "./graphs/workerGraph";
import type {TeamDefinition} from "./config/teams";
import type {AgentEvent} from "./types/events";

export class TeamOrchestrator {
    private graph: any;
    private llmModel: any;
    private toolRegistry: CodeToolRegistry;
    private delayMs: number;
    private workspacePath: string;

    // 🌟 新增：保存当前传入的团队配置
    private teamDef: TeamDefinition;

    // 🌟 构造函数新增 teamDef 参数
    constructor(
        teamDef: TeamDefinition,
        llmModel: any,
        workspacePath: string = process.cwd(),
        delayMs: number = 0
    ) {
        this.teamDef = teamDef; // 注入团队配置
        this.llmModel = llmModel;
        this.toolRegistry = new CodeToolRegistry(workspacePath);
        this.delayMs = delayMs;
        this.workspacePath = workspacePath;
        this.buildGlobalGraph();
    }

    private buildGlobalGraph() {
        const workerNodes: Record<string, any> = {};
        const workerRoles: string[] = [];

        // 1. 动态生成员工节点
        for (const agentDef of this.teamDef.members) {
            const subGraph = createWorkerGraph(
                agentDef,
                this.toolRegistry.resolveToolsForAgent(agentDef),
                this.llmModel,
                this.workspacePath
            );

            workerNodes[agentDef.role] = this.createWorkerWrapper(subGraph, agentDef.name);
            workerRoles.push(agentDef.role);
        }

        // 2. 动态生成大老板节点
        const supervisorNode = async (state: typeof GlobalStateAnnotation.State, config: any) => {

            // 🌟 修复错误 1：使用双重断言绕过 TypeScript 的 spread 推导限制
            const routeOptions = [...workerRoles, "FINISH"] as unknown as [string, ...string[]];

            const routingSchema = z.object({
                reasoning: z.string().optional().describe("你的内部思考过程，判断当前处于什么阶段。"),
                message: z.string().describe("如果派发任务，写给下级智能体的具体工作指令；如果只是打招呼或闲聊，写给用户的直接回复。"),
                nextWorker: z.enum(routeOptions).describe("下一个唤醒的智能体。如果是闲聊、或者任务已完成，必须输出 FINISH"),
            });

            const supervisorModel = this.llmModel.withStructuredOutput(routingSchema, { name: "route_task" });
            const systemPrompt = this.teamDef.supervisorPrompt;

            if (this.delayMs > 0) {
                await new Promise(resolve => setTimeout(resolve, this.delayMs));
            }

            const response = await supervisorModel.invoke([
                new SystemMessage(systemPrompt),
                ...state.messages
            ], config);

            return {
                nextWorker: response.nextWorker,
                messages: [new AIMessage({ content: response.message, name: "supervisor" })]
            };
        };

        // 3. 动态组装 LangGraph
        // 🌟 修复错误 2 & 3：显式声明为 any，打破 LangGraph 的节点字面量强类型校验锁
        let graphBuilder: any = new StateGraph(GlobalStateAnnotation)
            .addNode("supervisor", supervisorNode);

        for (const role of workerRoles) {
            graphBuilder = graphBuilder.addNode(role, workerNodes[role]);
            graphBuilder = graphBuilder.addEdge(role, "supervisor");
        }

        // 🌟 注意：这里为 state 显式指定类型，保证路由回调的安全
        graphBuilder = graphBuilder.addEdge(START, "supervisor")
            .addConditionalEdges(
                "supervisor",
                (state: typeof GlobalStateAnnotation.State) => state.nextWorker === "FINISH" ? END : state.nextWorker
            );

        this.graph = graphBuilder.compile();
    }

    // ==========================================================
    // 抽离的包装器函数 (保持代码整洁)
    // ==========================================================
    private createWorkerWrapper(subGraph: any, workerName: string) {
        return async (state: typeof GlobalStateAnnotation.State, config: any) => {
            const lastMessage = state.messages[state.messages.length - 1];
            const currentInstruction = lastMessage ? String(lastMessage.content) : "请继续执行任务";

            try {
                const subGraphResult = await subGraph.invoke({
                    currentTask: currentInstruction,
                    inheritedHeavyContext: state.heavyContext,
                    messages: [],
                    extractedResult: ""
                }, {
                    ...config,
                    recursionLimit: 8
                });

                const resultText = subGraphResult.extractedResult || "子任务执行结束，但未提取出有效的文本结论。";

                return {
                    messages: [new AIMessage({
                        content: `[${workerName} 汇报]: ${resultText}`,
                        name: workerName
                    })]
                };

            } catch (error: any) {
                if (error.name === 'GraphRecursionError' || error.message?.includes('recursion')) {
                    return {
                        messages: [new AIMessage({
                            content: `[${workerName} 异常退出]: 任务执行超过了最大允许步数。已强制终止。`,
                            name: workerName
                        })]
                    };
                }
                throw error;
            }
        };
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
                const {event: eventType, name, data} = event;

                switch (eventType) {
                    case "on_chat_model_stream":
                        // 模型正在打字输出
                        if (currentTopNode !== 'supervisor' && data?.chunk?.content) {
                            yield {type: 'message_chunk', content: data.chunk.content};
                        }
                        break;

                    case "on_tool_start":
                        yield {type: 'tool_start', toolName: name, args: data.input};
                        break;

                    case "on_tool_end":
                        yield {type: 'tool_end', toolName: name, result: "执行成功 (截断显示...)"};
                        break;

                    case "on_chain_start":
                        if (['supervisor', 'explorer', 'coder', 'verifier'].includes(name)) {
                            currentTopNode = name;
                            yield {type: 'agent_start', agentName: name, description: `开始执行子任务...`};
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
            yield {type: 'task_complete', finalResult};

        } catch (error: any) {
            // 捕获可能的主图 recursionLimit 异常并反馈给前端
            if (error.name === 'GraphRecursionError' || error.message?.includes('recursion')) {
                yield {type: 'error', message: "系统检测到死循环，已强制终止任务。"};
            } else {
                yield {type: 'error', message: error.message};
            }
        }
    }
}