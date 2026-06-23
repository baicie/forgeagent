import { Command } from 'commander'
import { chatCommand } from './chat'
import { configCommand } from './config'
import { runCommand } from './run'
import { skillCommand } from './skill'

export function createLegacyCommand(): Command {
  const command = new Command('legacy').description('Legacy template commands')

  command
    .command('chat')
    .description('Legacy interactive chat session')
    .argument('[prompt]', 'Initial prompt')
    .option('-w, --workspace <path>', 'Workspace directory', process.cwd())
    .option('-m, --model <name>', 'Model to use', 'openai/gpt-4.1')
    .action(
      async (
        prompt: string | undefined,
        options: { workspace: string; model: string },
      ) => {
        await chatCommand(prompt, options)
      },
    )

  command
    .command('run')
    .description('Legacy single task runner')
    .argument('<task>', 'Task description')
    .option('-w, --workspace <path>', 'Workspace directory', process.cwd())
    .option('-m, --model <name>', 'Model to use', 'openai/gpt-4.1')
    .action(
      async (task: string, options: { workspace: string; model: string }) => {
        await runCommand(task, options)
      },
    )

  command
    .command('skill')
    .description('Legacy skill manager')
    .addCommand(skillCommand)

  command
    .command('config')
    .description('Legacy configuration manager')
    .addCommand(configCommand)

  return command
}

export const legacyCommand = createLegacyCommand()
