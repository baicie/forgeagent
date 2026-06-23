import { Command } from 'commander'
import pc from 'picocolors'
import type { RunnerApiClientFactory } from '../client/runnerClient'
import { createRunnerApiClient } from '../client/runnerClient'
import type { watchTaskEvents as watchTaskEventsFn } from '../client/sse'
import { watchTaskEvents } from '../client/sse'
import { formatTask, formatTaskEvent } from '../output'

export interface CreateTaskCommandOptions {
  watchTaskEvents?: typeof watchTaskEventsFn
}

export function createTaskCommand(
  clientFactory: RunnerApiClientFactory = createRunnerApiClient,
  options: CreateTaskCommandOptions = {},
): Command {
  const command = new Command('task').description('Manage tasks')
  const watchEvents = options.watchTaskEvents || watchTaskEvents

  command
    .command('create')
    .description('Create a task')
    .requiredOption('--workspace <id>', 'Workspace id')
    .requiredOption('--prompt <prompt>', 'Task prompt')
    .option('--run', 'Run agent immediately after task creation')
    .action(
      async (actionOptions: {
        workspace: string
        prompt: string
        run?: boolean
      }) => {
        const client = clientFactory()
        const task = await client.createTask({
          workspaceId: actionOptions.workspace,
          prompt: actionOptions.prompt,
        })

        console.log(pc.green('Task created'))
        console.log(formatTask(task))
        console.log('')
        console.log(pc.dim(`Watch: forgeagent task watch ${task.id}`))
        console.log(pc.dim(`Diff:  forgeagent task diff ${task.id}`))

        if (actionOptions.run) {
          await client.runTask(task.id)
          console.log(pc.green('Agent started'))
        }
      },
    )

  command
    .command('list')
    .alias('ls')
    .description('List tasks')
    .action(async () => {
      const client = clientFactory()
      const tasks = await client.listTasks()

      if (tasks.length === 0) {
        console.log(pc.dim('No tasks found.'))
        return
      }

      console.log(tasks.map(formatTask).join('\n\n'))
    })

  command
    .command('watch')
    .description('Watch task events through SSE')
    .argument('<taskId>', 'Task id')
    .option('--after-id <eventId>', 'Resume after event id')
    .action(async (taskId: string, actionOptions: { afterId?: string }) => {
      const client = clientFactory()
      const controller = new AbortController()

      const onSigint = () => {
        controller.abort()
      }

      process.once('SIGINT', onSigint)

      console.log(pc.dim(`Watching ${taskId}. Press Ctrl+C to stop.`))

      try {
        await watchEvents({
          baseUrl: client.baseUrl,
          taskId,
          afterId: actionOptions.afterId,
          signal: controller.signal,
          onEvent(event) {
            console.log(formatTaskEvent(event))
          },
        })
      } finally {
        process.off('SIGINT', onSigint)
      }
    })

  command
    .command('run')
    .description('Run or resume a task agent loop')
    .argument('<taskId>', 'Task id')
    .action(async (taskId: string) => {
      const client = clientFactory()
      const result = await client.runTask(taskId)

      console.log(pc.green('Task run requested'))
      console.log(JSON.stringify(result, null, 2))
    })

  command
    .command('diff')
    .description('Show task diff')
    .argument('<taskId>', 'Task id')
    .action(async (taskId: string) => {
      const client = clientFactory()
      const result = await client.getTaskDiff(taskId)

      if (!result.diff.trim()) {
        console.log(pc.dim('Empty diff.'))
        return
      }

      process.stdout.write(result.diff)

      if (!result.diff.endsWith('\n')) {
        process.stdout.write('\n')
      }
    })

  command
    .command('apply')
    .description('Apply task patch to original repository')
    .argument('<taskId>', 'Task id')
    .action(async (taskId: string) => {
      const client = clientFactory()
      const task = await client.applyTask(taskId)

      console.log(pc.green('Task applied'))
      console.log(formatTask(task))
    })

  command
    .command('commit')
    .description('Commit task worktree changes')
    .argument('<taskId>', 'Task id')
    .option('--message <message>', 'Commit message')
    .action(async (taskId: string, actionOptions: { message?: string }) => {
      const client = clientFactory()
      const task = await client.commitTask(taskId, {
        message: actionOptions.message,
      })

      console.log(pc.green('Task committed'))
      console.log(formatTask(task))
    })

  command
    .command('discard')
    .description('Discard task worktree and temporary branch')
    .argument('<taskId>', 'Task id')
    .action(async (taskId: string) => {
      const client = clientFactory()
      const task = await client.discardTask(taskId)

      console.log(pc.green('Task discarded'))
      console.log(formatTask(task))
    })

  command
    .command('cancel')
    .description('Cancel a task')
    .argument('<taskId>', 'Task id')
    .action(async (taskId: string) => {
      const client = clientFactory()
      const task = await client.cancelTask(taskId)

      console.log(pc.green('Task cancelled'))
      console.log(formatTask(task))
    })

  return command
}

export const taskCommand = createTaskCommand()
