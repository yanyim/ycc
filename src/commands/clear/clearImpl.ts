import type { CommandContext } from '../../types/command';

export async function runClear(context: CommandContext) {
    console.clear();
    context.setHistory([]);
}
