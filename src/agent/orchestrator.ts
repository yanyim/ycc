// src/agent/orchestrator.ts
import { CodeToolRegistry } from "./tools/registry";
import type { TeamDefinition } from "./config/teams";
import type { Message } from "../types";
import type { AgentEvent } from "./types/events";
import { GraphEventTranslator } from "./shared/EventTranslator"; // 🌟 引入刚写的翻译器

export class TeamOrchestrator {
    private graph: any;
    private llmModel: any;
    private toolRegistry: CodeToolRegistry;
    private workspacePath: string;
    private delayMs: number;

    constructor(teamDef: TeamDefinition, llmModel: any, workspacePath: string = process.cwd(), delayMs: number = 0) {
        this.llmModel = llmModel;
        this.workspacePath = workspacePath;
        this.delayMs = delayMs;
        this.toolRegistry = new CodeToolRegistry(workspacePath);
        this.graph = teamDef.buildTeamGraph(this.llmModel, this.toolRegistry, this.workspacePath, this.delayMs);
    }

    public async* executeTask(chatHistory: Message[]): AsyncGenerator<AgentEvent, void, unknown> {
        const initialState = { messages: chatHistory };
        const stream = await this.graph.streamEvents(initialState, { version: "v2" });

        // 🌟 实例化翻译器，保持它在单次任务执行过程中的状态
        const translator = new GraphEventTranslator();

        for await (const rawEvent of stream) {
            // 将底层事件丢给翻译器，迭代吐出标准前端事件
            for (const cleanEvent of translator.translate(rawEvent)) {
                yield cleanEvent;
            }
        }
    }
}