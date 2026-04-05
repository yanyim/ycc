import {END, START, StateGraph} from "@langchain/langgraph";
import {AIMessage, HumanMessage, SystemMessage} from "@langchain/core/messages";
import {z} from "zod";
import {GlobalStateAnnotation} from "./state";
import {CODER_AGENT, EXPLORE_AGENT, VERIFIER_AGENT} from "./config/agents";
import {CodeToolRegistry} from "./tools/registry";
import {createWorkerGraph} from "./graphs/workerGraph";
import type {AgentEvent} from "./types/events";

export class CodeAgentOrchestrator {
    private graph: any; // 编译后的主图
    private llmModel: any;
    private toolRegistry: CodeToolRegistry;

    constructor(llmModel: any, workspacePath: string = process.cwd()) {
        this.llmModel = llmModel;
        this.toolRegistry = new CodeToolRegistry(workspacePath);
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
            this.llmModel
        );
        const coderSubGraph = createWorkerGraph(
            CODER_AGENT,
            this.toolRegistry.resolveToolsForAgent(CODER_AGENT),
            this.llmModel
        );
        const verifierSubGraph = createWorkerGraph(
            VERIFIER_AGENT,
            this.toolRegistry.resolveToolsForAgent(VERIFIER_AGENT),
            this.llmModel
        );

        // 2. 定义大老板节点 (Supervisor Node)
        const supervisorNode = async (state: typeof GlobalStateAnnotation.State) => {
            const routingSchema = z.object({
                reasoning: z.string().describe("你做出这个决定的思考过程"),
                nextWorker: z.enum(["explorer", "coder", "verifier", "FINISH"]).describe("下一个需要被唤醒的智能体，或者任务已完全解决时输出 FINISH"),
            });

            const supervisorModel = this.llmModel.withStructuredOutput(routingSchema, {name: "route_task"});

            const systemPrompt = `你是一个高级研发项目的统筹大脑(Supervisor)。你的团队有：
- explorer: 负责搜索、阅读代码，不改变文件。
- coder: 负责编写和修改代码。
- verifier: 负责运行测试验证代码。
根据当前的对话历史和任务进度，决定下一步派谁去工作。如果所有需求都已满足，并且(如果有代码修改)已经被 verifier 验证通过，则输出 FINISH。`;

            const response = await supervisorModel.invoke([
                new SystemMessage(systemPrompt),
                ...state.messages
            ]);

            return {
                nextWorker: response.nextWorker,
                messages: [new AIMessage({content: `[Supervisor 思考]: ${response.reasoning}`, name: "supervisor"})]
            };
        };

        // 3. 高阶工厂函数：包装子图
        const createWorkerWrapper = (subGraph: any, workerName: string) => {
            return async (state: typeof GlobalStateAnnotation.State) => {
                // [修复 Error 1]: 增加可选链和安全容错
                const lastMessage = state.messages[state.messages.length - 1];
                const currentInstruction = lastMessage ? String(lastMessage.content) : "请继续执行任务";

                const subGraphResult = await subGraph.invoke({
                    currentTask: currentInstruction,
                    inheritedHeavyContext: state.heavyContext,
                    localMessages: []
                });

                const finalMessage = subGraphResult.localMessages[subGraphResult.localMessages.length - 1];

                return {
                    messages: [new AIMessage({
                        content: `[${workerName} 汇报]: ${finalMessage.content}`,
                        name: workerName
                    })]
                };
            };
        };

        // 4 & 5. [修复 Error 2-6]: 改为严格的连续链式调用！
        // 这样 TypeScript 的推断流就能带着新节点类型一直往下传
        this.graph = new StateGraph(GlobalStateAnnotation)
            .addNode("supervisor", supervisorNode)
            .addNode("explorer", createWorkerWrapper(exploreSubGraph, "ExploreAgent"))
            .addNode("coder", createWorkerWrapper(coderSubGraph, "CoderAgent"))
            .addNode("verifier", createWorkerWrapper(verifierSubGraph, "VerifierAgent"))
            // 现在的 TS 能够正确识别这些自定义节点名了
            .addEdge(START, "supervisor")
            .addConditionalEdges(
                "supervisor",
                // 使用 as 强制收窄类型，让 TS 确认路由只会去这几个安全的终点
                (state) => state.nextWorker === "FINISH" ? END : state.nextWorker as "explorer" | "coder" | "verifier"
            )
            .addEdge("explorer", "supervisor")
            .addEdge("coder", "supervisor")
            .addEdge("verifier", "supervisor")
            .compile(); // 最终编译赋值
    }

    /**
     * 主入口：供 UI 层调用的事件流生成器
     * 🌟 修改：接收完整的 Message 历史，而不仅是单句 Prompt
     */
    public async* executeTask(chatHistory: {
        role: string,
        content: string
    }[]): AsyncGenerator<AgentEvent, void, unknown> {
        // 将普通 JSON 消息转换为 LangChain 标准 Message
        const langChainMessages = chatHistory.map(msg =>
            msg.role === 'user' ? new HumanMessage(msg.content) :
                msg.role === 'system' ? new SystemMessage(msg.content) :
                    new AIMessage(msg.content)
        );

        const initialState = {
            messages: langChainMessages,
            taskStatus: 'running' as const
        };

        const stream = await this.graph.streamEvents(initialState, {version: "v2"});
        try {
            for await (const event of stream) {
                const {event: eventType, name, data} = event;

                // 过滤并映射我们关心的事件给 UI 层
                switch (eventType) {
                    case "on_chat_model_stream":
                        // 模型正在打字输出
                        if (data?.chunk?.content) {
                            yield {type: 'message_chunk', content: data.chunk.content};
                        }
                        break;

                    case "on_tool_start":
                        // 拦截到某个打工人正在调用底层工具
                        yield {type: 'tool_start', toolName: name, args: data.input};
                        break;

                    case "on_tool_end":
                        // 工具执行完毕
                        yield {type: 'tool_end', toolName: name, result: "执行成功 (截断显示...)"};
                        break;

                    case "on_chain_start":
                        // 当进入某个特定 Agent 节点时抛出
                        if (['explorer', 'coder', 'verifier'].includes(name)) {
                            yield {type: 'agent_start', agentName: name, description: `开始执行子任务...`};
                        }
                        break;
                }
            }

            // 图执行完毕
            const finalState = await this.graph.getState();
            const finalMessages = finalState.values.messages;
            const lastMsg = finalMessages[finalMessages.length - 1];

            yield {type: 'task_complete', finalResult: lastMsg.content};

        } catch (error: any) {
            yield {type: 'error', message: error.message};
        }
    }
}