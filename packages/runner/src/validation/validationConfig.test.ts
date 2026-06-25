import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { loadValidationConfig } from './validationConfig'

describe('loadValidationConfig', () => {
  let tempDir: string

  beforeEach(async () => {
    tempDir = await mkdtemp(path.join(tmpdir(), 'forgeagent-validation-'))
  })

  afterEach(async () => {
    await rm(tempDir, { recursive: true, force: true })
  })

  it('loads .agents/validation.yaml', async () => {
    await mkdir(path.join(tempDir, '.agents'), { recursive: true })
    await writeFile(
      path.join(tempDir, '.agents/validation.yaml'),
      [
        'validation:',
        '  commands:',
        '    - pnpm typecheck',
        '    - pnpm test:run',
        '  maxFixAttempts: 2',
      ].join('\n'),
    )

    const config = await loadValidationConfig({
      repoRoot: tempDir,
    })

    expect(
      (config.commands as Array<{ command: string }>).map(
        command => command.command,
      ),
    ).toEqual(['pnpm typecheck', 'pnpm test:run'])
    expect(config.maxFixAttempts).toBe(2)
  })

  it('task validation overrides project commands', async () => {
    await mkdir(path.join(tempDir, '.agents'), { recursive: true })
    await writeFile(
      path.join(tempDir, '.agents/validation.yaml'),
      'validation:\n  commands:\n    - pnpm build\n',
    )

    const config = await loadValidationConfig({
      repoRoot: tempDir,
      taskValidation: {
        commands: ['pnpm test'],
      },
    })

    expect(
      (config.commands as Array<{ command: string }>).map(
        command => command.command,
      ),
    ).toEqual(['pnpm test'])
  })

  it('infers package scripts when no config exists', async () => {
    await writeFile(
      path.join(tempDir, 'package.json'),
      JSON.stringify({
        scripts: {
          typecheck: 'tsc --noEmit',
          'test:run': 'vitest run',
          build: 'tsup',
        },
      }),
    )

    const config = await loadValidationConfig({
      repoRoot: tempDir,
    })

    expect(
      (config.commands as Array<{ command: string }>).map(
        command => command.command,
      ),
    ).toEqual(['pnpm typecheck', 'pnpm test:run', 'pnpm build'])
  })

  it('returns empty commands when nothing is configured', async () => {
    const config = await loadValidationConfig({
      repoRoot: tempDir,
    })

    expect(config.commands).toEqual([])
  })

  it('task maxFixAttempts overrides project maxFixAttempts', async () => {
    await mkdir(path.join(tempDir, '.agents'), { recursive: true })
    await writeFile(
      path.join(tempDir, '.agents/validation.yaml'),
      'validation:\n  maxFixAttempts: 5\n',
    )

    const config = await loadValidationConfig({
      repoRoot: tempDir,
      taskValidation: {
        maxFixAttempts: 1,
      },
    })

    expect(config.maxFixAttempts).toBe(1)
  })
})
