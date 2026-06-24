import { startRunnerServer, validateRunnerStartupConfig } from './server'
import { loadRunnerConfig } from './config'

const TEST_PORT = 17892

describe('runner server phase 12 startup validation', () => {
  const originalEnv = process.env

  beforeEach(() => {
    process.env = { ...originalEnv }
    delete process.env.FORGEAGENT_MODEL_API_KEY
    process.env.FORGEAGENT_MODEL_BASE_URL = 'https://api.openai.com/v1'
    process.env.FORGEAGENT_MODEL_NAME = 'gpt-4.1-mini'
  })

  afterEach(() => {
    process.env = originalEnv
  })

  it('validates model config for primary runner startup path', () => {
    expect(() => validateRunnerStartupConfig()).toThrow(
      expect.objectContaining({
        code: 'MODEL_CONFIG_MISSING',
      }),
    )
  })

  it('startRunnerServer fails before binding when model config is missing', async () => {
    await expect(
      startRunnerServer({
        config: loadRunnerConfig({
          host: '127.0.0.1',
          port: TEST_PORT,
          dataDir: '/tmp/forgeagent-test-startup',
        }),
      }),
    ).rejects.toMatchObject({
      code: 'MODEL_CONFIG_MISSING',
    })
  })

  it('can skip model config validation for tests', async () => {
    const server = await startRunnerServer({
      config: loadRunnerConfig({
        host: '127.0.0.1',
        port: TEST_PORT,
        dataDir: '/tmp/forgeagent-test-startup-skip',
      }),
      skipModelConfigValidation: true,
    })

    await server.close()
  })
})
