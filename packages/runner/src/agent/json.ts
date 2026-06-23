import { createForgeAgentError } from '@forgeagent/core'
import { z } from 'zod'

export const AgentToolNameSchema = z.enum([
  'list_files',
  'read_file',
  'search_text',
  'apply_patch',
  'run_command',
  'get_diff',
])

export type AgentToolName = z.infer<typeof AgentToolNameSchema>

export const AgentActionSchema = z.object({
  name: AgentToolNameSchema,
  args: z.unknown().default({}),
})

export type AgentAction = z.infer<typeof AgentActionSchema>

export const AgentFinalSummarySchema = z.object({
  changes: z.array(z.string()).default([]),
  tests: z.array(z.string()).default([]),
  risks: z.array(z.string()).default([]),
  nextSteps: z.array(z.string()).default([]),
})

export type AgentFinalSummary = z.infer<typeof AgentFinalSummarySchema>

export const AgentStepResponseSchema = z
  .object({
    message: z.string().min(1),
    action: AgentActionSchema.optional(),
    final: z.boolean().optional(),
    summary: AgentFinalSummarySchema.optional(),
  })
  .refine(value => value.final || value.action, {
    message: 'Agent response must contain either final=true or action',
  })

export type AgentStepResponse = z.infer<typeof AgentStepResponseSchema>

function stripCodeFence(content: string): string {
  const trimmed = content.trim()

  /* eslint-disable-next-line regexp/no-super-linear-backtracking */
  const fence = trimmed.match(/^```(?:json)?\s*([\s\S]*?)\s*```$/i)

  if (fence) {
    return fence[1].trim()
  }

  return trimmed
}

export function parseJsonObject(content: string): unknown {
  const stripped = stripCodeFence(content)

  try {
    return JSON.parse(stripped)
  } catch (error) {
    throw createForgeAgentError(
      'MODEL_RESPONSE_INVALID',
      'Invalid JSON output',
      {
        content,
        stripped,
        cause: error instanceof Error ? error.message : String(error),
      },
    )
  }
}

export function parseAgentStepResponse(content: string): AgentStepResponse {
  const parsed = parseJsonObject(content)
  const result = AgentStepResponseSchema.safeParse(parsed)

  if (!result.success) {
    throw createForgeAgentError(
      'MODEL_RESPONSE_INVALID',
      'Agent JSON output does not match protocol',
      {
        content,
        issues: result.error.flatten(),
      },
    )
  }

  return result.data
}

export function normalizeFinalSummary(
  message: string,
  summary?: AgentFinalSummary,
): AgentFinalSummary {
  return {
    changes: summary?.changes?.length ? summary.changes : [message],
    tests: summary?.tests ?? [],
    risks: summary?.risks ?? [],
    nextSteps: summary?.nextSteps ?? [],
  }
}
