import { createCliProgram } from './cli'

describe('createCliProgram', () => {
  it('registers ForgeAgent primary commands', () => {
    const program = createCliProgram()

    expect(program.commands.map(command => command.name())).toEqual([
      'runner',
      'workspace',
      'task',
      'legacy',
    ])
  })

  it('does not expose legacy chat/run as primary commands', () => {
    const program = createCliProgram()
    const names = program.commands.map(command => command.name())

    expect(names).not.toContain('chat')
    expect(names).not.toContain('run')
  })
})
