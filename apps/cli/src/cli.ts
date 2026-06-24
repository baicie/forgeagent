import { configCommand } from './commands/config'
import { Command } from 'commander'
import type { RunnerApiClientFactory } from './client/runnerClient'
import { legacyCommand } from './commands/legacy'
import { runnerCommand } from './commands/runner'
import { createTaskCommand } from './commands/task'
import { createWorkspaceCommand } from './commands/workspace'
import { createApprovalCommand } from './commands/approval'

export interface CreateCliProgramOptions {
  clientFactory?: RunnerApiClientFactory
}

export function createCliProgram(options: CreateCliProgramOptions = {}) {
  const program = new Command()

  program
    .name('forgeagent')
    .description('ForgeAgent local-first Agent OS CLI')
    .version('0.1.0')
    .showHelpAfterError()

  program.addCommand(createApprovalCommand())
  program.addCommand(runnerCommand)
  program.addCommand(createWorkspaceCommand(options.clientFactory))
  program.addCommand(createTaskCommand(options.clientFactory))
  program.addCommand(configCommand)
  program.addCommand(legacyCommand)

  return program
}
