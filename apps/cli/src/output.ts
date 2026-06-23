import pc from 'picocolors'
import type { Task, TaskEvent, Workspace } from './client/types'

function asRecord(value: unknown): Record<string, unknown> {
  return typeof value === 'object' && value !== null
    ? (value as Record<string, unknown>)
    : {}
}

export function formatWorkspace(workspace: Workspace): string {
  return [
    `${pc.bold(workspace.id)} ${workspace.name}`,
    `  repo: ${workspace.repoPath}`,
    `  root: ${workspace.gitRoot}`,
    workspace.currentBranch
      ? `  branch: ${workspace.currentBranch}`
      : undefined,
    workspace.currentCommit
      ? `  commit: ${workspace.currentCommit}`
      : undefined,
  ]
    .filter(Boolean)
    .join('\n')
}

export function formatTask(task: Task): string {
  return [
    `${pc.bold(task.id)} ${pc.cyan(task.status)}`,
    `  workspace: ${task.workspaceId}`,
    `  prompt: ${task.prompt}`,
    `  worktree: ${task.worktreePath}`,
    `  base: ${task.baseBranch}@${task.baseCommit}`,
  ].join('\n')
}

export function formatTaskEvent(event: TaskEvent): string {
  const payload = asRecord(event.payload)
  const time = new Date(event.createdAt).toLocaleTimeString()

  switch (event.type) {
    case 'agent.message':
      return `${pc.dim(time)} ${pc.cyan('agent')} ${String(payload.message || '')}`

    case 'task.status':
      return `${pc.dim(time)} ${pc.yellow('status')} ${String(
        payload.previousStatus || '',
      )}${payload.previousStatus ? ' -> ' : ''}${String(payload.status || '')}${
        payload.reason ? ` (${String(payload.reason)})` : ''
      }`

    case 'approval.required':
      return [
        `${pc.dim(time)} ${pc.red('approval required')}`,
        `  id: ${String(payload.approvalId || '')}`,
        `  risk: ${String(payload.risk || 'unknown')}`,
        `  command: ${String(payload.command || '')}`,
        payload.reason ? `  reason: ${String(payload.reason)}` : undefined,
      ]
        .filter(Boolean)
        .join('\n')

    case 'approval.resolved':
      return `${pc.dim(time)} ${pc.green('approval resolved')} ${String(
        payload.approvalId || '',
      )} ${String(payload.status || '')}`

    case 'tool.started':
      return `${pc.dim(time)} ${pc.magenta('tool started')} ${String(
        payload.toolName || '',
      )}`

    case 'tool.output':
      return `${pc.dim(time)} ${pc.gray(String(payload.stream || 'output'))} ${
        payload.chunk !== undefined
          ? String(payload.chunk)
          : JSON.stringify(payload)
      }`

    case 'tool.finished':
      return `${pc.dim(time)} ${pc.magenta('tool finished')} ${String(
        payload.toolName || '',
      )} ${
        payload.error
          ? pc.red(String(payload.error))
          : JSON.stringify(payload.result)
      }`

    case 'diff.updated':
      return `${pc.dim(time)} ${pc.blue('diff')} changed=${String(
        payload.changed,
      )} bytes=${String(payload.bytes)}`

    case 'task.completed':
      return `${pc.dim(time)} ${pc.green('task completed')}`

    case 'task.failed':
      return `${pc.dim(time)} ${pc.red('task failed')} ${JSON.stringify(
        payload.error,
      )}`

    default:
      return `${pc.dim(time)} ${event.type} ${JSON.stringify(event.payload)}`
  }
}
