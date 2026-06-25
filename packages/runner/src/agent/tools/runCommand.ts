import type { CommandRiskLevel, TaskStatus } from '@forgeagent/core'
import { classifyCommandRisk, createForgeAgentError } from '@forgeagent/core'
import { z } from 'zod'
import { assertSafeReadablePath } from './common'
import type { RunnerToolContext } from './types'

export const RunCommandArgsSchema = z.object({
  command: z.string().min(1),
  cwd: z.string().default('.'),
  reason: z.string().min(1).default('Agent requested command execution'),
  toolCallId: z.string().min(1).optional(),
})

export type RunCommandArgs = z.infer<typeof RunCommandArgsSchema>

export interface RunCommandResult {
  approvalId: string
  status: 'waiting_approval'
  risk: CommandRiskLevel
  command: string
  cwd: string
}

const APPROVAL_ALLOWED_STATUSES: TaskStatus[] = [
  'created',
  'preparing',
  'running',
  'waiting_approval',
]

function assertCanRequestCommandApproval(status: TaskStatus): void {
  if (!APPROVAL_ALLOWED_STATUSES.includes(status)) {
    throw createForgeAgentError(
      'TASK_NOT_RUNNING',
      `Task cannot request command approval from status: ${status}`,
      {
        status,
      },
    )
  }
}

async function ensureWaitingApproval(
  context: RunnerToolContext,
): Promise<void> {
  const task = context.taskService.get(context.task.id)

  switch (task.status) {
    case 'created':
      await context.taskService.prepare(task.id, 'Preparing command approval')
      await context.taskService.start(
        task.id,
        'Running before command approval',
      )
      await context.taskService.waitForApproval(
        task.id,
        'Command requires approval',
      )
      return

    case 'preparing':
      await context.taskService.start(
        task.id,
        'Running before command approval',
      )
      await context.taskService.waitForApproval(
        task.id,
        'Command requires approval',
      )
      return

    case 'running':
      await context.taskService.waitForApproval(
        task.id,
        'Command requires approval',
      )
      return

    case 'waiting_approval':
      return

    default:
      throw createForgeAgentError(
        'TASK_NOT_RUNNING',
        `Task cannot request command approval from status: ${task.status}`,
        {
          taskId: task.id,
          status: task.status,
        },
      )
  }
}

export async function runCommandTool(
  context: RunnerToolContext,
  rawArgs: unknown,
): Promise<RunCommandResult> {
  const args = RunCommandArgsSchema.parse(rawArgs)
  const task = context.taskService.get(context.task.id)

  assertCanRequestCommandApproval(task.status)

  const cwd = assertSafeReadablePath(context, args.cwd)
  const risk = classifyCommandRisk(args.command)
  const toolCallId = args.toolCallId ?? `tool_${Date.now().toString(36)}`

  const approval = await context.approvalService.create({
    taskId: task.id,
    toolCallId,
    command: args.command,
    cwd: cwd.absolutePath,
    reason: args.reason,
    risk: risk.level,
  })

  await ensureWaitingApproval(context)

  return {
    approvalId: approval.id,
    status: 'waiting_approval',
    risk: approval.risk,
    command: approval.command,
    cwd: approval.cwd,
  }
}
