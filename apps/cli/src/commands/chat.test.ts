import { chatCommand } from './chat'

describe('chatCommand', () => {
  it('returns early when no prompt is provided', async () => {
    const logSpy = vi.spyOn(console, 'log').mockImplementation(() => {})

    await expect(chatCommand(undefined)).resolves.toBeUndefined()

    expect(logSpy).toHaveBeenCalledWith('No prompt provided. Exiting.')

    logSpy.mockRestore()
  })
})
