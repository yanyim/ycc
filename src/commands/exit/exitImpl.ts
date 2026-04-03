import type { CommandContext } from '../../types/command';

export async function runExit(context: CommandContext) {
    process.exit(0);
}
