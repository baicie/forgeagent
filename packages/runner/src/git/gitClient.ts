import type { ForgeAgentErrorCode } from '@forgeagent/core'
import { createForgeAgentError } from '@forgeagent/core'
import { execFile } from 'node:child_process'
import { promisify } from 'node:util'

const execFileAsync = promisify(execFile)

export interface GitCommandOptions {
  cwd: string
  timeoutMs?: number
}

export interface GitCommandResult {
  stdout: string
  stderr: string
}

interface ExecFileError extends Error {
  code?: number | string
  stdout?: string | Buffer
  stderr?: string | Buffer
}

function normalizeOutput(value: unknown): string {
  if (typeof value === 'string') {
    return value
  }

  if (Buffer.isBuffer(value)) {
    return value.toString('utf-8')
  }

  return ''
}

function classifyGitFailure(stderr: string): ForgeAgentErrorCode {
  const lower = stderr.toLowerCase()

  if (
    lower.includes('not a git repository') ||
    lower.includes('not a git repo') ||
    lower.includes('fatal: not a git')
  ) {
    return 'WORKSPACE_NOT_GIT_REPOSITORY'
  }

  if (
    lower.includes('unknown revision') ||
    lower.includes('bad revision') ||
    lower.includes('ambiguous argument') ||
    lower.includes('needed a single revision') ||
    lower.includes('does not have any commits yet') ||
    lower.includes('no commits') ||
    lower.includes('empty repository')
  ) {
    return 'WORKSPACE_EMPTY_GIT_REPOSITORY'
  }

  if (
    lower.includes('no such reference') ||
    lower.includes('not a working tree') ||
    lower.includes('is not a working tree') ||
    (lower.includes('worktree') &&
      (lower.includes('not found') || lower.includes('does not exist')))
  ) {
    return 'GIT_WORKTREE_NOT_FOUND'
  }

  return 'INVALID_GIT_REPO'
}

export class GitClient {
  async run(
    args: string[],
    options: GitCommandOptions,
  ): Promise<GitCommandResult> {
    try {
      const result = await execFileAsync('git', args, {
        cwd: options.cwd,
        timeout: options.timeoutMs ?? 30_000,
        maxBuffer: 10 * 1024 * 1024,
        windowsHide: true,
      })

      return {
        stdout: normalizeOutput(result.stdout),
        stderr: normalizeOutput(result.stderr),
      }
    } catch (error) {
      const gitError = error as ExecFileError
      const stderr = normalizeOutput(gitError.stderr)
      const stdout = normalizeOutput(gitError.stdout)
      const code = classifyGitFailure(stderr)
      const message = stderr.trim() || gitError.message

      throw createForgeAgentError(
        code,
        `Git command failed: git ${args.join(' ')}`,
        {
          cwd: options.cwd,
          args,
          exitCode: gitError.code,
          stdout,
          stderr,
          message,
        },
      )
    }
  }

  async output(args: string[], options: GitCommandOptions): Promise<string> {
    const result = await this.run(args, options)

    return result.stdout.trim()
  }
}
