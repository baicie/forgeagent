import {
  DEFAULT_MAX_FIX_ATTEMPTS,
  ValidationConfigSchema,
  normalizeValidationCommands,
} from './validation'

describe('validation domain', () => {
  it('normalizes string commands', () => {
    expect(normalizeValidationCommands(['pnpm test'])).toEqual([
      {
        command: 'pnpm test',
        cwd: '.',
        reason: 'Validate task changes',
      },
    ])
  })

  it('normalizes mixed string and object commands', () => {
    expect(
      normalizeValidationCommands([
        'pnpm test',
        { command: 'pnpm build', cwd: './dist', reason: 'Build check' },
      ]),
    ).toEqual([
      {
        command: 'pnpm test',
        cwd: '.',
        reason: 'Validate task changes',
      },
      {
        command: 'pnpm build',
        cwd: './dist',
        reason: 'Build check',
      },
    ])
  })

  it('parses default config', () => {
    const config = ValidationConfigSchema.parse({})

    expect(config.commands).toEqual([])
    expect(config.maxFixAttempts).toBe(DEFAULT_MAX_FIX_ATTEMPTS)
  })

  it('parses explicit config', () => {
    const config = ValidationConfigSchema.parse({
      commands: ['pnpm typecheck'],
      maxFixAttempts: 2,
    })

    expect(config.commands).toMatchObject([
      { command: 'pnpm typecheck', cwd: '.', reason: 'Validate task changes' },
    ])
    expect(config.maxFixAttempts).toBe(2)
  })

  it('normalizes string commands to command objects', () => {
    const config = ValidationConfigSchema.parse({
      commands: ['pnpm test', 'pnpm build'],
      maxFixAttempts: 1,
    })

    expect(config.commands).toMatchObject([
      { command: 'pnpm test', cwd: '.', reason: 'Validate task changes' },
      { command: 'pnpm build', cwd: '.', reason: 'Validate task changes' },
    ])
  })
})
