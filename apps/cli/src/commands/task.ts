import { Command } from 'commander'
import { TaskMemoryFileNameSchema, formatBytes } from '@forgeagent/core'
import pc from 'picocolors'
import type { RunnerApiClientFactory } from '../client/runnerClient'
import { createRunnerApiClient } from '../client/runnerClient'
import type { watchTaskEvents as watchTaskEventsFn } from '../client/sse'
import { watchTaskEvents } from '../client/sse'
import {
  formatTask,
  formatTaskAppliedHint,
  formatTaskCreatedHint,
  formatTaskEvent,
} from '../output'

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
    .option('--validate <commands...>', 'Validation command(s)')
    .option('--max-fix-attempts <n>', 'Max validation fix attempts', value =>
      Number.parseInt(value, 10),
    )
    .action(
      async (actionOptions: {
        workspace: string
        prompt: string
        run?: boolean
        validate?: string[]
        maxFixAttempts?: number
      }) => {
        const client = clientFactory()
        const task = await client.createTask({
          workspaceId: actionOptions.workspace,
          prompt: actionOptions.prompt,
          validation:
            actionOptions.validate || actionOptions.maxFixAttempts !== undefined
              ? {
                  commands: actionOptions.validate,
                  maxFixAttempts: actionOptions.maxFixAttempts,
                }
              : undefined,
        })

        console.log(pc.green('Task created'))
        console.log(formatTask(task))
        console.log('')
        console.log(
          pc.yellow('Agent will modify only the isolated task worktree.'),
        )
        console.log(
          pc.yellow(
            'The original repository will not change until you apply the task.',
          ),
        )
        console.log('')
        console.log(formatTaskCreatedHint(task))

        if (actionOptions.run) {
          await client.runTask(task.id)
          console.log('')
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
    .command('cleanup')
    .description('Delete task worktrees and task records')
    .option('--yes', 'Skip confirmation')
    .option('--task <taskId>', 'Cleanup one task only')
    .action(async (actionOptions: { yes?: boolean; task?: string }) => {
      const client = clientFactory()
      const preview = await client.getTaskCleanupPreview({
        taskId: actionOptions.task,
      })

      const target = actionOptions.task
        ? `task ${actionOptions.task}`
        : 'all tasks'

      console.log(
        pc.yellow(`This will delete ${target} managed by ForgeAgent.`),
      )
      console.log(`  tasks: ${preview.count}`)
      console.log(
        `  estimated reclaimable space: ${formatBytes(preview.estimatedBytes)}`,
      )

      if (preview.tasks.length > 0) {
        console.log('')
        console.log(pc.dim('Targets:'))
        for (const task of preview.tasks) {
          console.log(
            pc.dim(
              `  ${task.id} ${task.status} ${formatBytes(task.estimatedBytes)} ${task.worktreePath}`,
            ),
          )
        }
      }

      if (!actionOptions.yes) {
        console.log('')
        console.log(pc.dim('Re-run with --yes to confirm.'))
        return
      }

      if (actionOptions.task) {
        await client.deleteTask(actionOptions.task)
        console.log(pc.green('Task cleanup completed'))
        console.log(`  deleted: 1`)
        console.log(`  failed: 0`)
        return
      }

      const result = await client.cleanupTasks()

      console.log(pc.green('Task cleanup completed'))
      console.log(`  deleted: ${result.deleted}`)
      console.log(`  failed: ${result.failed}`)
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
      console.log('')
      console.log(pc.dim(`Watch: forgeagent task watch ${taskId}`))
    })

  command
    .command('diff')
    .description('Show task diff')
    .argument('<taskId>', 'Task id')
    .action(async (taskId: string) => {
      const client = clientFactory()
      const task = await client.getTask(taskId)
      const result = await client.getTaskDiff(taskId)

      console.log(
        pc.yellow('Diff is generated from the isolated task worktree.'),
      )
      console.log(pc.dim(`Worktree: ${task.worktreePath}`))
      console.log(
        pc.dim('Original repository is unchanged until you apply the task.'),
      )
      console.log('')

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
    .command('memory')
    .description('Show task external working memory')
    .argument('<taskId>', 'Task id')
    .option('--file <file>', 'Memory file name')
    .action(async (taskId: string, actionOptions: { file?: string }) => {
      const client = clientFactory()

      if (actionOptions.file) {
        const fileName = TaskMemoryFileNameSchema.parse(actionOptions.file)
        const file = await client.getTaskMemoryFile(taskId, fileName)

        console.log(pc.green(file.file))
        console.log(pc.dim(`bytes: ${file.bytes}`))
        console.log('')
        process.stdout.write(file.content)

        if (!file.content.endsWith('\n')) {
          process.stdout.write('\n')
        }

        return
      }

      const snapshot = await client.getTaskMemory(taskId)

      console.log(pc.green(`Task memory: ${snapshot.taskId}`))
      console.log(pc.dim(snapshot.runDir))
      console.log('')

      for (const file of snapshot.files) {
        console.log(pc.yellow(file.file))
        console.log(pc.dim(`bytes: ${file.bytes}`))
        console.log(file.content.trimEnd())
        console.log('')
      }
    })

  command
    .command('apply')
    .description('Apply task patch to original repository')
    .argument('<taskId>', 'Task id')
    .action(async (taskId: string) => {
      const client = clientFactory()
      const task = await client.applyTask(taskId)
      const workspace = await client.getWorkspace(task.workspaceId)

      console.log(pc.green('Task applied'))
      console.log(formatTask(task))
      console.log('')
      console.log(formatTaskAppliedHint(workspace))
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
      console.log('')
      console.log(pc.yellow('Commit was created in the task worktree branch.'))
      console.log(pc.yellow('The original repository branch was not modified.'))
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
      console.log('')
      console.log(
        pc.dim(
          'Worktree and temporary branch were removed. Original repository was not modified.',
        ),
      )
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
