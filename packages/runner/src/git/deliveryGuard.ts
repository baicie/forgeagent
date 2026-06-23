import { createForgeAgentError } from '@forgeagent/core'
import type { Task } from '@forgeagent/core'
import type { GitRepositoryService } from './repository'

export interface AssertOriginalRepoReadyInput {
  task: Task
  gitRoot: string
  gitRepositoryService: GitRepositoryService
}

export async function assertOriginalRepoReadyForApply(
  input: AssertOriginalRepoReadyInput,
): Promise<void> {
  const repositoryInfo = await input.gitRepositoryService.getRepositoryInfo(
    input.gitRoot,
  )

  if (repositoryInfo.currentCommit !== input.task.baseCommit) {
    throw createForgeAgentError(
      'PATCH_APPLY_FAILED',
      'Original repository HEAD has changed since task was created',
      {
        taskId: input.task.id,
        gitRoot: input.gitRoot,
        expectedCommit: input.task.baseCommit,
        actualCommit: repositoryInfo.currentCommit,
      },
    )
  }

  if (repositoryInfo.isDirty) {
    throw createForgeAgentError(
      'PATCH_APPLY_FAILED',
      'Original repository has uncommitted changes',
      {
        taskId: input.task.id,
        gitRoot: input.gitRoot,
      },
    )
  }
}
