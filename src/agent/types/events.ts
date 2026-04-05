// src/agent/types/events.ts

export type AgentRole = 'supervisor' | 'explorer' | 'coder' | 'verifier';
export type ModelTier = 'fast' | 'reasoning' | 'inherit';
export type IsolationMode = 'read-only' | 'tmp-only' | 'workspace-rw';

/**
 * 暴露给 CLI 终端界面的标准事件流
 */
export type AgentEvent =
    | { type: 'agent_start'; agentName: string; description: string }
    | { type: 'tool_start'; toolName: string; args: any }
    | { type: 'tool_end'; toolName: string; result: string }
    | { type: 'message_chunk'; content: string }
    | { type: 'human_intervention_required'; prompt: string; resumePayload: any }
    | { type: 'task_complete'; finalResult: string }
    | { type: 'error'; message: string };