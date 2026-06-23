import { Command } from 'commander'
import { resolve } from 'node:path'
import pc from 'picocolors'
import type { RunnerApiClientFactory } from '../client/runnerClient'
import { createRunnerApiClient } from '../client/runnerClient'
import { formatWorkspace } from '../output'

export function createWorkspaceCommand(
  clientFactory: RunnerApiClientFactory = createRunnerApiClient,
): Command {
  const command = new Command('workspace').description('Manage workspaces')

  command
    .command('add')
    .description('Add a local Git repository as workspace')
    .argument('<repoPath>', 'Local Git repository path')
    .option('--name <name>', 'Workspace display name')
    .action(async (repoPath: string, options: { name?: string }) => {
      const client = clientFactory()
      const workspace = await client.createWorkspace({
        repoPath: resolve(repoPath),
        name: options.name,
      })

      console.log(pc.green('Workspace added'))
      console.log(formatWorkspace(workspace))
    })

  command
    .command('list')
    .alias('ls')
    .description('List workspaces')
    .action(async () => {
      const client = clientFactory()
      const workspaces = await client.listWorkspaces()

      if (workspaces.length === 0) {
        console.log(pc.dim('No workspaces found.'))
        return
      }

      console.log(workspaces.map(formatWorkspace).join('\n\n'))
    })

  return command
}

export const workspaceCommand = createWorkspaceCommand()
