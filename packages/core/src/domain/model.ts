import { z } from 'zod'

export const ModelProviderTypeSchema = z.enum([
  'openai-compatible',
  'deepseek',
  'qwen',
  'glm',
  'ollama',
  'vllm',
])

export type ModelProviderType = z.infer<typeof ModelProviderTypeSchema>

export const ModelProviderConfigSchema = z.object({
  id: z.string().min(1),
  type: ModelProviderTypeSchema,
  name: z.string().min(1),
  baseUrl: z.string().url(),
  apiKeyEnv: z.string().min(1).optional(),
  defaultModel: z.string().min(1),
})

export type ModelProviderConfig = z.infer<typeof ModelProviderConfigSchema>

export const ModelMessageRoleSchema = z.enum([
  'system',
  'user',
  'assistant',
  'tool',
])

export type ModelMessageRole = z.infer<typeof ModelMessageRoleSchema>

export const ModelMessageSchema = z.object({
  role: ModelMessageRoleSchema,
  content: z.string(),
  name: z.string().optional(),
})

export type ModelMessage = z.infer<typeof ModelMessageSchema>

export const ModelGenerateInputSchema = z.object({
  model: z.string().min(1),
  messages: z.array(ModelMessageSchema),
  temperature: z.number().min(0).max(2).optional(),
})

export type ModelGenerateInput = z.infer<typeof ModelGenerateInputSchema>

export const ModelGenerateResultSchema = z.object({
  content: z.string(),
  raw: z.unknown().optional(),
})

export type ModelGenerateResult = z.infer<typeof ModelGenerateResultSchema>
