import { createForgeAgentError } from '@forgeagent/core'
import { mkdir, rm } from 'node:fs/promises'
import { resolve } from 'node:path'
import type { GitClient } from './gitClient'

export interface CreateWorktreeInput {
  gitRoot: string
  taskId: string
  dataDir: string
}

export interface WorktreeInfo {
  worktreePath: string
  branchName: string
}

function safeTaskId(taskId: string): string {
  return taskId.replaceAll(/[^\w.-]/g, '-')
}

export function getTaskWorktreeBranch(taskId: string): string {
  return `forgeagent/task-${safeTaskId(taskId)}`
}

export function getTaskWorktreePath(dataDir: string, taskId: string): string {
  return resolve(dataDir, 'worktrees', safeTaskId(taskId))
}

export class GitWorktreeService {
  constructor(private readonly gitClient: GitClient) {}

  async create(input: CreateWorktreeInput): Promise<WorktreeInfo> {
    const worktreePath = getTaskWorktreePath(input.dataDir, input.taskId)
    const branchName = getTaskWorktreeBranch(input.taskId)

    await mkdir(resolve(input.dataDir, 'worktrees'), {
      recursive: true,
    })

    await this.gitClient.run(
      ['worktree', 'add', worktreePath, '-b', branchName],
      {
        cwd: input.gitRoot,
      },
    )

    return {
      worktreePath,
      branchName,
    }
  }

  async remove(gitRoot: string, worktreePath: string): Promise<void> {
    await this.gitClient.run(['worktree', 'remove', worktreePath, '--force'], {
      cwd: gitRoot,
    })
  }

  async deleteBranch(gitRoot: string, branchName: string): Promise<void> {
    try {
      await this.gitClient.run(['branch', '-D', branchName], {
        cwd: gitRoot,
      })
    } catch (error) {
      const details = (error as { details?: unknown }).details

      if (
        typeof details === 'object' &&
        details !== null &&
        'stderr' in details &&
        String((details as { stderr?: unknown }).stderr).includes(
          'branch not found',
        )
      ) {
        return
      }

      throw error
    }
  }

  async discard(
    gitRoot: string,
    worktreePath: string,
    taskId: string,
  ): Promise<void> {
    const branchName = getTaskWorktreeBranch(taskId)

    try {
      await this.remove(gitRoot, worktreePath)
    } catch (error) {
      const details = (error as { details?: unknown }).details
      const stderr =
        typeof details === 'object' && details !== null && 'stderr' in details
          ? String((details as { stderr?: unknown }).stderr)
          : ''

      if (!stderr.includes('is not a working tree')) {
        throw error
      }

      await rm(worktreePath, {
        recursive: true,
        force: true,
      })
    }

    try {
      await this.deleteBranch(gitRoot, branchName)
    } catch (error) {
      throw createForgeAgentError(
        'INVALID_GIT_REPO',
        `Failed to delete worktree branch: ${branchName}`,
        {
          gitRoot,
          worktreePath,
          branchName,
          cause: error instanceof Error ? error.message : String(error),
        },
      )
    }
  }
}
