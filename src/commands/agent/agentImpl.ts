// src/commands/agent/agentImpl.ts
import type { CommandContext } from '../../types/command';
import { useConfigStore } from '../../storage';
import { TEAM_REGISTRY } from '../../agent/config/teams';

export async function runAgent(context: CommandContext) {
    const targetTeamId = context.args[0];
    const { currentTeamId, setCurrentTeamId } = useConfigStore.getState();

    // 🌟 1. 交互选择模式：如果没有输入 targetTeamId，激活 UI 列表
    if (!targetTeamId) {
        // 将 TEAM_REGISTRY 转换为 { label, value } 数组
        const teamOptions = Array.from(TEAM_REGISTRY.entries()).map(([id, team]) => ({
            label: `${team.name} (${id}) - ${team.description}`,
            value: id // value 保存真实的 ID，用于后续提交
        }));

        // 触发 UI 进入团队选择模式
        context.setAvailableCommands(teamOptions);
        context.setMode('agent-selection');

        // 发送一条友好的系统提示
        await context.addMessage({
            id: crypto.randomUUID(),
            role: 'system',
            content: `[系统] 请使用上下方向键选择要切换的多智能体团队，或按退格键取消。`
        });
        return;
    }

    // 🌟 以下为原有的校验与执行逻辑
    if (!TEAM_REGISTRY.has(targetTeamId)) {
        await context.addMessage({
            id: crypto.randomUUID(),
            role: 'system',
            content: `[系统错误] 找不到名为 '${targetTeamId}' 的团队。`
        });
        // 如果输入错误，记得重置模式
        context.setMode('normal');
        return;
    }

    if (targetTeamId === currentTeamId) {
        await context.addMessage({
            id: crypto.randomUUID(),
            role: 'system',
            content: `[系统] 你当前已经在 '${targetTeamId}' 团队中，无需切换。`
        });
        context.setMode('normal');
        return;
    }

    // 执行切换
    setCurrentTeamId(targetTeamId);
    const targetTeam = TEAM_REGISTRY.get(targetTeamId)!;

    await context.addMessage({
        id: crypto.randomUUID(),
        role: 'system',
        content: `[系统成功] 切换成功！\n系统已重新分配大老板，并集结了【${targetTeam.name}】。\n${targetTeam.description}`
    });

    // 🌟 切换成功后，务必将 UI 状态恢复到正常对话模式
    context.setMode('normal');
}