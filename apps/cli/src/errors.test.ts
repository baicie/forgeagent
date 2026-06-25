import { formatCliError } from './errors'

describe('formatCliError', () => {
  it('prints runner unavailable hint', () => {
    const output = formatCliError({
      code: 'RUNNER_UNAVAILABLE',
      message: 'Runner is not available at http://127.0.0.1:17890',
      details: {
        hint: 'Start the runner first: forgeagent runner start',
      },
    })

    expect(output).toContain('[RUNNER_UNAVAILABLE]')
    expect(output).toContain('forgeagent runner start')
  })

  it('prints model config actions', () => {
    const output = formatCliError({
      code: 'MODEL_CONFIG_MISSING',
      message: 'Model API key is missing',
      details: {
        env: 'FORGEAGENT_MODEL_API_KEY',
      },
    })

    expect(output).toContain('FORGEAGENT_MODEL_API_KEY')
    expect(output).toContain('FORGEAGENT_MODEL_BASE_URL')
  })
})
