import { createForgeAgentError } from '@forgeagent/core'
import { spawn } from 'node:child_process'

export const DEFAULT_COMMAND_TIMEOUT_MS = 120_000

export interface ShellOutputChunk {
  stream: 'stdout' | 'stderr'
  chunk: string
}

export interface ShellExecutionInput {
  command: string
  cwd: string
  timeoutMs?: number
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
  startedAt: string
  finishedAt: string
}

export class ShellExecutor {
  async execute(input: ShellExecutionInput): Promise<ShellExecutionResult> {
    const startedAt = new Date().toISOString()
    const timeoutMs = input.timeoutMs ?? DEFAULT_COMMAND_TIMEOUT_MS

    let stdout = ''
    let stderr = ''
    let timedOut = false

    return new Promise<ShellExecutionResult>((resolve, reject) => {
      const child = spawn(input.command, {
        cwd: input.cwd,
        shell: true,
        windowsHide: true,
        env: process.env,
      })

      const timer = setTimeout(() => {
        timedOut = true
        child.kill('SIGTERM')
      }, timeoutMs)

      child.stdout?.on('data', chunk => {
        const text = chunk.toString('utf-8')
        stdout += text
        void input.onOutput?.({
          stream: 'stdout',
          chunk: text,
        })
      })

      child.stderr?.on('data', chunk => {
        const text = chunk.toString('utf-8')
        stderr += text
        void input.onOutput?.({
          stream: 'stderr',
          chunk: text,
        })
      })

      child.on('error', error => {
        clearTimeout(timer)

        reject(
          createForgeAgentError(
            'TOOL_EXECUTION_FAILED',
            `Failed to start command: ${input.command}`,
            {
              command: input.command,
              cwd: input.cwd,
              cause: error.message,
            },
          ),
        )
      })

      child.on('close', (exitCode, signal) => {
        clearTimeout(timer)

        const finishedAt = new Date().toISOString()

        resolve({
          ok: !timedOut && exitCode === 0,
          command: input.command,
          cwd: input.cwd,
          exitCode,
          signal,
          timedOut,
          stdout,
          stderr,
          startedAt,
          finishedAt,
        })
      })
    })
  }
}
