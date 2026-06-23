import { spawn } from 'node:child_process'

export const DEFAULT_COMMAND_TIMEOUT_MS = 120_000
export const DEFAULT_COMMAND_KILL_GRACE_MS = 5_000

export interface ShellOutputChunk {
  stream: 'stdout' | 'stderr'
  chunk: string
}

export interface ShellExecutionInput {
  command: string
  cwd: string
  timeoutMs?: number
  killGraceMs?: number
  onOutput?: (chunk: ShellOutputChunk) => void | Promise<void>
}

export interface ShellExecutionResult {
  ok: boolean
  command: string
  cwd: string
  exitCode: number | null
  signal: NodeJS.Signals | string | null
  timedOut: boolean
  stdout: string
  stderr: string
  error?: string
  startedAt: string
  finishedAt: string
}

export class ShellExecutor {
  async execute(input: ShellExecutionInput): Promise<ShellExecutionResult> {
    const startedAt = new Date().toISOString()
    const timeoutMs = input.timeoutMs ?? DEFAULT_COMMAND_TIMEOUT_MS
    const killGraceMs = input.killGraceMs ?? DEFAULT_COMMAND_KILL_GRACE_MS

    let stdout = ''
    let stderr = ''
    let timedOut = false

    return new Promise<ShellExecutionResult>(resolve => {
      let settled = false
      let timeout: NodeJS.Timeout | undefined
      let forceKillTimeout: NodeJS.Timeout | undefined

      const finish = (result: {
        exitCode: number | null
        signal: NodeJS.Signals | string | null
        error?: string
      }) => {
        if (settled) {
          return
        }

        settled = true

        if (timeout) {
          clearTimeout(timeout)
        }

        if (forceKillTimeout) {
          clearTimeout(forceKillTimeout)
        }

        resolve({
          ok: !timedOut && result.exitCode === 0 && !result.error,
          command: input.command,
          cwd: input.cwd,
          exitCode: result.exitCode,
          signal: result.signal,
          timedOut,
          stdout,
          stderr,
          error: result.error,
          startedAt,
          finishedAt: new Date().toISOString(),
        })
      }

      let child: ReturnType<typeof spawn>

      try {
        child = spawn(input.command, {
          cwd: input.cwd,
          shell: true,
          windowsHide: true,
          env: process.env,
        })
      } catch (error) {
        finish({
          exitCode: null,
          signal: null,
          error: error instanceof Error ? error.message : String(error),
        })
        return
      }

      timeout = setTimeout(() => {
        timedOut = true
        child.kill('SIGTERM')

        forceKillTimeout = setTimeout(() => {
          if (!settled) {
            child.kill('SIGKILL')
          }
        }, killGraceMs)
      }, timeoutMs)

      child.stdout?.on('data', chunk => {
        const text = chunk.toString('utf-8')
        stdout += text

        void Promise.resolve(
          input.onOutput?.({
            stream: 'stdout',
            chunk: text,
          }),
        ).catch(() => {
          // Output event failures are handled by the caller.
        })
      })

      child.stderr?.on('data', chunk => {
        const text = chunk.toString('utf-8')
        stderr += text

        void Promise.resolve(
          input.onOutput?.({
            stream: 'stderr',
            chunk: text,
          }),
        ).catch(() => {
          // Output event failures are handled by the caller.
        })
      })

      child.on('error', error => {
        finish({
          exitCode: null,
          signal: null,
          error: error.message,
        })
      })

      child.on('close', (exitCode, signal) => {
        finish({
          exitCode,
          signal,
        })
      })
    })
  }
}
