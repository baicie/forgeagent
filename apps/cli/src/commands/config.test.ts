import { mkdir, mkdtemp, readFile, realpath, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { configCommand } from './config'

describe('configCommand', () => {
  it('initializes forgeagent.config.json', async () => {
    const cwd = process.cwd()
    const tempDir = await mkdtemp(join(tmpdir(), 'forgeagent-config-'))

    const logSpy = vi.spyOn(console, 'log').mockImplementation(() => {})

    try {
      await mkdir(tempDir, { recursive: true })
      process.chdir(tempDir)

      await configCommand.parseAsync(['node', 'forgeagent', 'init'])

      const content = await readFile(
        join(tempDir, 'forgeagent.config.json'),
        'utf-8',
      )
      const json = JSON.parse(content) as {
        model: string
        workspace: string
        skillsDir: string
        maxSteps: number
      }

      expect(json.model).toBe('openai/gpt-4.1')
      const normalizedWorkspace = await realpath(json.workspace)
      const normalizedTemp = await realpath(tempDir)
      expect(normalizedWorkspace).toBe(normalizedTemp)
      expect(json.skillsDir).toBe('./skills')
      expect(json.maxSteps).toBe(20)
    } finally {
      process.chdir(cwd)
      logSpy.mockRestore()
      await rm(tempDir, { recursive: true, force: true })
    }
  })
})
