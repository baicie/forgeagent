import {
  OpenAICompatibleModelGateway,
  loadModelGatewayConfigFromEnv,
} from './model'

/* eslint-disable-next-line test/prefer-lowercase-title */
describe('OpenAICompatibleModelGateway', () => {
  it('calls OpenAI-compatible chat completions endpoint', async () => {
    const fetchImpl = vi.fn(async () => ({
      ok: true,
      status: 200,
      statusText: 'OK',
      text: async () => '',
      json: async () => ({
        choices: [
          {
            message: {
              content: '{"message":"ok","final":true}',
            },
          },
        ],
      }),
    }))

    const gateway = new OpenAICompatibleModelGateway(
      {
        baseUrl: 'http://localhost:11434/v1',
        apiKey: 'test-key',
        model: 'qwen',
      },
      fetchImpl,
    )

    const result = await gateway.generate({
      messages: [
        {
          role: 'user',
          content: 'hello',
        },
      ],
    })

    expect(result.content).toContain('"final":true')
    expect(fetchImpl).toHaveBeenCalledWith(
      'http://localhost:11434/v1/chat/completions',
      expect.objectContaining({
        method: 'POST',
        headers: expect.objectContaining({
          Authorization: 'Bearer test-key',
        }),
      }),
    )
  })

  it('throws structured error for non-2xx response', async () => {
    const fetchImpl = vi.fn(async () => ({
      ok: false,
      status: 401,
      statusText: 'Unauthorized',
      text: async () => 'bad key',
      json: async () => ({}),
    }))

    const gateway = new OpenAICompatibleModelGateway(
      {
        baseUrl: 'http://localhost:8000/v1',
        apiKey: 'bad-key',
        model: 'deepseek-chat',
      },
      fetchImpl,
    )

    await expect(
      gateway.generate({
        messages: [
          {
            role: 'user',
            content: 'hello',
          },
        ],
      }),
    ).rejects.toMatchObject({
      code: 'MODEL_REQUEST_FAILED',
    })
  })

  it('loads env config', () => {
    const originalBaseUrl = process.env.FORGEAGENT_MODEL_BASE_URL
    const originalApiKey = process.env.FORGEAGENT_MODEL_API_KEY
    const originalModel = process.env.FORGEAGENT_MODEL_NAME

    process.env.FORGEAGENT_MODEL_BASE_URL = 'http://localhost:11434/v1'
    process.env.FORGEAGENT_MODEL_API_KEY = 'ollama'
    process.env.FORGEAGENT_MODEL_NAME = 'qwen2.5-coder'

    try {
      expect(loadModelGatewayConfigFromEnv()).toEqual({
        baseUrl: 'http://localhost:11434/v1',
        apiKey: 'ollama',
        model: 'qwen2.5-coder',
        temperature: 0,
      })
    } finally {
      process.env.FORGEAGENT_MODEL_BASE_URL = originalBaseUrl
      process.env.FORGEAGENT_MODEL_API_KEY = originalApiKey
      process.env.FORGEAGENT_MODEL_NAME = originalModel
    }
  })
})
