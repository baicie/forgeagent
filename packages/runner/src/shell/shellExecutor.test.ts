import { ShellExecutor } from './shellExecutor'

describe('shellExecutor', () => {
  it('executes a command and captures stdout', async () => {
    const executor = new ShellExecutor()
    const chunks: string[] = []

    const result = await executor.execute({
      command: `node -e "console.log('forgeagent-ok')"`,
      cwd: process.cwd(),
      timeoutMs: 10_000,
      onOutput: chunk => {
        chunks.push(chunk.chunk)
      },
    })

    expect(result.ok).toBe(true)
    expect(result.exitCode).toBe(0)
    expect(result.stdout).toContain('forgeagent-ok')
    expect(chunks.join('')).toContain('forgeagent-ok')
  }, 20000)

  it('captures stderr and non-zero exit code', async () => {
    const executor = new ShellExecutor()

    const result = await executor.execute({
      command: `node -e "console.error('forgeagent-error'); process.exit(2)"`,
      cwd: process.cwd(),
      timeoutMs: 10_000,
    })

    expect(result.ok).toBe(false)
    expect(result.exitCode).toBe(2)
    expect(result.stderr).toContain('forgeagent-error')
  }, 20000)

  it('marks timed out commands', async () => {
    const executor = new ShellExecutor()

    const result = await executor.execute({
      command: `node -e "setTimeout(() => {}, 1000)"`,
      cwd: process.cwd(),
      timeoutMs: 50,
    })

    expect(result.ok).toBe(false)
    expect(result.timedOut).toBe(true)
  }, 20000)
})
