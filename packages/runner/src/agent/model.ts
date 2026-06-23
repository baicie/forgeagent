import { createForgeAgentError } from '@forgeagent/core'

export interface ChatMessage {
  role: 'system' | 'user' | 'assistant'
  content: string
}

export interface ModelGatewayConfig {
  baseUrl: string
  apiKey?: string
  model: string
  temperature?: number
}

export interface ModelGenerateInput {
  messages: ChatMessage[]
  temperature?: number
}

export interface ModelGenerateResult {
  content: string
  raw?: unknown
}

export interface FetchLike {
  (
    input: string | URL,
    init?: {
      method?: string
      headers?: Record<string, string>
      body?: string
      signal?: AbortSignal
    },
  ): Promise<{
    ok: boolean
    status: number
    statusText: string
    text: () => Promise<string>
    json: () => Promise<unknown>
  }>
}

export interface OpenAICompatibleChatChoice {
  message?: {
    content?: string | null
  }
}

export interface OpenAICompatibleChatResponse {
  choices?: OpenAICompatibleChatChoice[]
}

export function loadModelGatewayConfigFromEnv(): ModelGatewayConfig {
  return {
    baseUrl:
      process.env.FORGEAGENT_MODEL_BASE_URL || 'https://api.openai.com/v1',
    apiKey: process.env.FORGEAGENT_MODEL_API_KEY,
    model: process.env.FORGEAGENT_MODEL_NAME || 'gpt-4.1-mini',
    temperature: 0,
  }
}

function joinUrl(baseUrl: string, path: string): string {
  return `${baseUrl.replace(/\/+$/, '')}/${path.replace(/^\/+/, '')}`
}

export class OpenAICompatibleModelGateway {
  constructor(
    private readonly config: ModelGatewayConfig,
    private readonly fetchImpl: FetchLike = fetch as unknown as FetchLike,
  ) {}

  async generate(input: ModelGenerateInput): Promise<ModelGenerateResult> {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    }

    if (this.config.apiKey) {
      headers.Authorization = `Bearer ${this.config.apiKey}`
    }

    let response: Awaited<ReturnType<FetchLike>>

    try {
      response = await this.fetchImpl(
        joinUrl(this.config.baseUrl, '/chat/completions'),
        {
          method: 'POST',
          headers,
          body: JSON.stringify({
            model: this.config.model,
            messages: input.messages,
            temperature: input.temperature ?? this.config.temperature ?? 0,
          }),
        },
      )
    } catch (error) {
      throw createForgeAgentError(
        'MODEL_REQUEST_FAILED',
        'Model request failed before receiving response',
        {
          baseUrl: this.config.baseUrl,
          model: this.config.model,
          cause: error instanceof Error ? error.message : String(error),
        },
      )
    }

    if (!response.ok) {
      const body = await response.text()

      throw createForgeAgentError(
        'MODEL_REQUEST_FAILED',
        `Model request failed: ${response.status} ${response.statusText}`,
        {
          status: response.status,
          statusText: response.statusText,
          body,
        },
      )
    }

    let raw: OpenAICompatibleChatResponse

    try {
      raw = (await response.json()) as OpenAICompatibleChatResponse
    } catch (error) {
      throw createForgeAgentError(
        'MODEL_RESPONSE_INVALID',
        'Model response is not valid JSON',
        {
          cause: error instanceof Error ? error.message : String(error),
        },
      )
    }

    const content = raw.choices?.[0]?.message?.content

    if (!content) {
      throw createForgeAgentError(
        'MODEL_RESPONSE_INVALID',
        'Model response does not contain choices[0].message.content',
        {
          raw,
        },
      )
    }

    return {
      content,
      raw,
    }
  }
}
