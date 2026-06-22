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
  stdout?: string
  stderr?: string
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
        stdout: String(result.stdout),
        stderr: String(result.stderr),
      }
    } catch (error) {
      const gitError = error as ExecFileError
      const stderr = String(gitError.stderr)
      const stdout = String(gitError.stdout)
      const message = stderr.trim() || gitError.message

      throw createForgeAgentError(
        'INVALID_GIT_REPO',
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
