import { createLegacyCommand } from './legacy'

describe('legacy command', () => {
  it('registers skill and config directly under legacy', () => {
    const command = createLegacyCommand()
    const names = command.commands.map(item => item.name())

    expect(names).toEqual(['chat', 'run', 'skill', 'config'])
  })

  it('does not double nest skill/config commands', () => {
    const command = createLegacyCommand()
    const skill = command.commands.find(item => item.name() === 'skill')
    const config = command.commands.find(item => item.name() === 'config')

    expect(skill?.commands.map(item => item.name())).toEqual(['list'])
    expect(config?.commands.map(item => item.name())).toEqual(['show', 'init'])
  })
})
