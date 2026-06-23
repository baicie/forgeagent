import type { Task, Workspace } from '@forgeagent/core'
import type { RunnerContext } from '../context'
import type { RunnerToolContext } from './tools/types'

export interface AgentRunContext {
  runner: RunnerContext
  task: Task
  workspace: Workspace
  toolContext: RunnerToolContext
}

export function createAgentRunContext(
  runner: RunnerContext,
  taskId: string,
): AgentRunContext {
  const task = runner.taskService.get(taskId)
  const workspace = runner.workspaceService.get(task.workspaceId)

  return {
    runner,
    task,
    workspace,
    toolContext: {
      task,
      workspace,
      worktreePath: task.worktreePath,
      taskService: runner.taskService,
      approvalService: runner.approvalService,
    },
  }
}
