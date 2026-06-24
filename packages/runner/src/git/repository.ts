import { ForgeAgentError, createForgeAgentError } from '@forgeagent/core'
import { access } from 'node:fs/promises'
import { resolve } from 'node:path'
import type { GitClient } from './gitClient'

export interface GitRepositoryInfo {
  repoPath: string
  gitRoot: string
  currentBranch: string
  currentCommit: string
  isDirty: boolean
}

interface GitCliErrorDetails {
  cwd?: string
  args?: string[]
  exitCode?: number | string
  stdout?: string
  stderr?: string
  message?: string
}

function readGitCliErrorText(error: unknown): string {
  if (!(error instanceof ForgeAgentError)) {
    if (error && typeof error === 'object') {
      const candidate = error as {
        message?: string
        stderr?: string | Buffer
        stdout?: string | Buffer
      }
      const stderr =
        typeof candidate.stderr === 'string'
          ? candidate.stderr
          : Buffer.isBuffer(candidate.stderr)
            ? candidate.stderr.toString('utf-8')
            : ''
      const stdout =
        typeof candidate.stdout === 'string'
          ? candidate.stdout
          : Buffer.isBuffer(candidate.stdout)
            ? candidate.stdout.toString('utf-8')
            : ''

      return [candidate.message, stderr, stdout]
        .filter((part): part is string => typeof part === 'string')
        .filter(part => part.length > 0)
        .join('\n')
    }

    return error instanceof Error ? error.message : String(error)
  }

  const details = error.details as GitCliErrorDetails | undefined
  const stderr = details?.stderr || ''
  const message = details?.message || error.message

  return [message, stderr].filter(Boolean).join('\n')
}

function isNotGitRepositoryText(text: string): boolean {
  const lower = text.toLowerCase()

  return (
    lower.includes('not a git repository') ||
    lower.includes('not a git repo') ||
    lower.includes('fatal: not a git') ||
    lower.includes('--show-toplevel')
  )
}

function isEmptyGitRepositoryText(text: string): boolean {
  const lower = text.toLowerCase()

  return (
    lower.includes('unknown revision') ||
    lower.includes('bad revision') ||
    lower.includes('ambiguous argument') ||
    lower.includes('needed a single revision') ||
    lower.includes('does not have any commits yet') ||
    lower.includes('first commit')
  )
}

const NOT_GIT_REPOSITORY_HINT =
  'Initialize a Git repository first:\n' +
  '  git init\n' +
  '  git add .\n' +
  '  git commit -m "chore: initial commit"'

const EMPTY_REPO_HINT =
  'Create the initial commit before adding this workspace:\n' +
  '  git add .\n' +
  '  git commit -m "chore: initial commit"'

function wrapGitCliError(error: unknown): never {
  const text = readGitCliErrorText(error)

  if (isNotGitRepositoryText(text)) {
    throw createForgeAgentError(
      'WORKSPACE_NOT_GIT_REPOSITORY',
      'Workspace path is not inside a Git repository',
      {
        gitOutput: text,
        hint: NOT_GIT_REPOSITORY_HINT,
      },
    )
  }

  if (isEmptyGitRepositoryText(text)) {
    throw createForgeAgentError(
      'WORKSPACE_EMPTY_GIT_REPOSITORY',
      'Workspace Git repository has no commits yet',
      {
        gitOutput: text,
        hint: EMPTY_REPO_HINT,
      },
    )
  }

  throw error
}

export class GitRepositoryService {
  constructor(private readonly gitClient: GitClient) {}

  async getRepositoryInfo(repoPath: string): Promise<GitRepositoryInfo> {
    const resolvedRepoPath = resolve(repoPath)

    try {
      await access(resolvedRepoPath)
    } catch (error) {
      const code = (error as NodeJS.ErrnoException).code

      if (code === 'ENOENT' || code === 'EACCES') {
        throw createForgeAgentError(
          'INVALID_GIT_REPO',
          `Git repository path is not accessible: ${repoPath}`,
          {
            repoPath,
            resolvedRepoPath,
            cause: error instanceof Error ? error.message : String(error),
          },
        )
      }

      throw error
    }

    const gitRoot = await this.getGitRoot(resolvedRepoPath)
    const currentCommit = await this.getCurrentCommit(gitRoot)
    const currentBranch = await this.getCurrentBranch(gitRoot)
    const isDirty = await this.isDirty(gitRoot)

    return {
      repoPath: resolvedRepoPath,
      gitRoot,
      currentBranch,
      currentCommit,
      isDirty,
    }
  }

  async getGitRoot(repoPath: string): Promise<string> {
    let gitRoot: string

    try {
      gitRoot = await this.gitClient.output(['rev-parse', '--show-toplevel'], {
        cwd: repoPath,
      })
    } catch (error) {
      wrapGitCliError(error)
    }

    if (!gitRoot) {
      throw createForgeAgentError(
        'WORKSPACE_NOT_GIT_REPOSITORY',
        `Workspace path is not inside a Git repository: ${repoPath}`,
        {
          repoPath,
          hint: NOT_GIT_REPOSITORY_HINT,
        },
      )
    }

    return resolve(gitRoot)
  }

  async getCurrentBranch(gitRoot: string): Promise<string> {
    const branch = await this.gitClient.output(
      ['rev-parse', '--abbrev-ref', 'HEAD'],
      {
        cwd: gitRoot,
      },
    )

    return branch || 'HEAD'
  }

  async getCurrentCommit(gitRoot: string): Promise<string> {
    try {
      return await this.gitClient.output(['rev-parse', 'HEAD'], {
        cwd: gitRoot,
      })
    } catch (error) {
      wrapGitCliError(error)
    }
  }

  async isDirty(gitRoot: string): Promise<boolean> {
    const status = await this.gitClient.output(['status', '--porcelain'], {
      cwd: gitRoot,
    })

    return status.length > 0
  }
}
