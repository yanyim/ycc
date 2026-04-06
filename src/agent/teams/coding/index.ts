// src/agent/teams/coding/index.ts
import { START, END, StateGraph } from "@langchain/langgraph";
import type { TeamDefinition } from "../../config/teams";
import { GlobalStateAnnotation } from "../../state";
import { EXPLORE_AGENT, CODER_AGENT, VERIFIER_AGENT } from "../../config/agents";
import { getSupervisorSystemPrompt } from "../../prompts/supervisor";
import { createWorkerGraph } from "../../shared/workerGraph";
import { AIMessage } from "@langchain/core/messages";

export const CODING_TEAM: TeamDefinition = {
    id: 'coding',
    name: '核心研发团队',
    description: '采用标准星型拓扑，由总管协调探索、编写与测试。',

    buildTeamGraph: (llmModel, toolRegistry, workspacePath) => {
        let workflow: any = new StateGraph(GlobalStateAnnotation);

        const members = [EXPLORE_AGENT, CODER_AGENT, VERIFIER_AGENT];
        const supervisorPrompt = getSupervisorSystemPrompt();

        // 1. 大老板节点 (Supervisor)
        const supervisorNode = async (state: typeof GlobalStateAnnotation.State) => {
            const response = await llmModel.invoke([
                { role: "system", content: supervisorPrompt },
                ...state.messages
            ]);
            return { messages: [response] };
        };
        workflow = workflow.addNode("supervisor", supervisorNode);

        // 2. 动态注入打工人 (Workers)
        for (const member of members) {
            const tools = toolRegistry.resolveToolsForAgent(member as any);

            // 🌟 修复 1: 严格按照 createWorkerGraph 的新签名传参
            // (agentDef, tools, llmModel, workspacePath)
            const workerGraph = createWorkerGraph(member, tools, llmModel, workspacePath);

            // 🌟 修复 2: AgentDefinition 中没有 id，应该使用 name 作为节点标识符
            workflow = workflow.addNode(member.name, workerGraph);
            workflow = workflow.addEdge(member.name, "supervisor"); // 打工人干完活必须汇报给老板
        }

        // 3. 拓扑边缘连线
        workflow = workflow.addEdge(START, "supervisor");

        // 🌟 提取出原 Orchestrator 中的动态路由逻辑
        workflow = workflow.addConditionalEdges("supervisor", (state: typeof GlobalStateAnnotation.State) => {
            const messages = state.messages;
            const lastMessage = messages[messages.length - 1] as AIMessage;
            const content = typeof lastMessage?.content === 'string' ? lastMessage.content : '';

            // 如果老板决定结束
            if (content.includes("FINISH") || content.includes("任务完成")) {
                return END;
            }

            // 🌟 修复 4: 使用 member.name 进行意图识别和路由跳转
            const assignedMember = members.find(m => content.includes(m.name));
            if (assignedMember) {
                return assignedMember.name;
            }

            // 默认兜底
            return END;
        });

        return workflow.compile();
    }
};