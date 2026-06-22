import { createCliProgram } from './cli'

describe('forgeagent CLI', () => {
  it('uses forgeagent as the CLI name', () => {
    const program = createCliProgram()

    expect(program.name()).toBe('forgeagent')
    expect(program.description()).toBe('ForgeAgent OS CLI')
    expect(program.version()).toBe('0.1.0')
  })

  it('keeps Phase 2 commands available', () => {
    const program = createCliProgram()

    expect(program.commands.map(command => command.name())).toEqual([
      'chat',
      'run',
      'runner',
      'skill',
      'config',
    ])
  })

  it('renders help with runner command', () => {
    const help = createCliProgram().helpInformation()

    expect(help).toContain('Usage: forgeagent')
    expect(help).toContain('ForgeAgent OS CLI')
    expect(help).toContain('runner')
  })
})
