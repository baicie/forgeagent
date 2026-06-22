import { z } from 'zod'
import type { RunnerToolContext } from './types'

export const GetDiffArgsSchema = z.object({}).default({})

export interface GetDiffResult {
  taskId: string
  diff: string
}

export async function getDiffTool(
  context: RunnerToolContext,
  rawArgs: unknown,
): Promise<GetDiffResult> {
  GetDiffArgsSchema.parse(rawArgs ?? {})

  return context.taskService.getDiff(context.task.id)
}
