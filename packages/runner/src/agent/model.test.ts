import {
  loadModelGatewayConfigFromEnv,
  validateModelGatewayConfig,
} from './model'

describe('model config phase 12', () => {
  const originalEnv = process.env

  beforeEach(() => {
    process.env = { ...originalEnv }
  })

  afterEach(() => {
    process.env = originalEnv
  })

  it('throws MODEL_CONFIG_MISSING for remote model without api key', () => {
    expect(() =>
      validateModelGatewayConfig({
        baseUrl: 'https://api.openai.com/v1',
        model: 'gpt-4.1-mini',
      }),
    ).toThrow(expect.objectContaining({ code: 'MODEL_CONFIG_MISSING' }))
  })

  it('throws MODEL_CONFIG_MISSING for empty base URL', () => {
    expect(() =>
      validateModelGatewayConfig({
        baseUrl: '',
        model: 'qwen2.5-coder',
        apiKey: 'sk-test',
      }),
    ).toThrow(expect.objectContaining({ code: 'MODEL_CONFIG_MISSING' }))
  })

  it('throws MODEL_CONFIG_MISSING for empty model', () => {
    expect(() =>
      validateModelGatewayConfig({
        baseUrl: 'https://api.openai.com/v1',
        model: '',
        apiKey: 'sk-test',
      }),
    ).toThrow(expect.objectContaining({ code: 'MODEL_CONFIG_MISSING' }))
  })

  it('allows localhost model without api key', () => {
    expect(
      validateModelGatewayConfig({
        baseUrl: 'http://localhost:11434/v1',
        model: 'qwen2.5-coder',
      }),
    ).toMatchObject({
      baseUrl: 'http://localhost:11434/v1',
      model: 'qwen2.5-coder',
    })
  })

  it('loads model config from env', () => {
    process.env.FORGEAGENT_MODEL_BASE_URL = 'https://api.deepseek.com/v1'
    process.env.FORGEAGENT_MODEL_API_KEY = 'sk-test'
    process.env.FORGEAGENT_MODEL_NAME = 'deepseek-chat'

    expect(loadModelGatewayConfigFromEnv()).toMatchObject({
      baseUrl: 'https://api.deepseek.com/v1',
      apiKey: 'sk-test',
      model: 'deepseek-chat',
    })
  })
})
