// src/agent/orchestrator.ts
import { CodeToolRegistry } from "./tools/registry";
import type { TeamDefinition } from "./config/teams";
import type { BaseMessage } from "@langchain/core/messages";

export class TeamOrchestrator {
    // 🌟 核心：无论底下是多么复杂的黑盒团队，在 Orchestrator 眼里，它只是一个跑得动的图实例
    private graph: any;
    private llmModel: any;
    private toolRegistry: CodeToolRegistry;
    private workspacePath: string;

    /**
     * @param teamDef 当前用户选择的特种团队 (例如 CODING_TEAM 或 BATCH_REFACTOR_TEAM)
     * @param llmModel 已经初始化好的 LLM 模型实例
     * @param workspacePath 当前工作区路径，默认是 process.cwd()
     */
    constructor(
        teamDef: TeamDefinition,
        llmModel: any,
        workspacePath: string = process.cwd()
    ) {
        this.llmModel = llmModel;
        this.workspacePath = workspacePath;

        // 统一初始化工具注册表，把文件系统读写权限圈定在当前工作区
        this.toolRegistry = new CodeToolRegistry(workspacePath);

        // =========================================================
        // 🌟 极致优雅：控制反转 (IoC)
        // Orchestrator 完全不关心团队内部是“星型大老板”还是“流水线”
        // 只要团队实现了 buildTeamGraph 接口，直接拿来用！
        // =========================================================
        this.graph = teamDef.buildTeamGraph(
            this.llmModel,
            this.toolRegistry,
            this.workspacePath
        );
    }

    /**
     * 核心执行引擎：负责将用户的对话推入图，并利用 streamEvents 进行事件流式穿透
     * @param chatHistory 终端中积累的历史对话 (包含用户的当前指令)
     */
    public async* executeTask(chatHistory: BaseMessage[]) {
        // 构造触发图运行的初始状态
        // （无论什么拓扑结构，LangGraph 至少都有一根 messages 的主轴）
        const initialState = {
            messages: chatHistory
        };

        // 🌟 利用 LangGraph V2 的 streamEvents，它能穿透任何复杂的嵌套拓扑
        // 完美捕获底层 Agent 的思考、工具调用等细粒度事件
        const stream = await this.graph.streamEvents(initialState, { version: "v2" });

        for await (const event of stream) {
            // 在这里我们只负责把事件“抛”出去，交由 CLI 的 UI 层 (Ink) 去渲染
            yield event;
        }
    }
}