import type { WorkflowDefinition } from '@forgeagent/core'
import { WorkflowDefinitionSchema } from '@forgeagent/core'
import { readFile } from 'node:fs/promises'
import path from 'node:path'
import { parse as parseYaml } from 'yaml'
import { getBuiltinWorkflow } from './builtinWorkflows'

export interface LoadWorkflowInput {
  repoRoot: string
  workflowId?: string
}

async function readOptionalFile(filePath: string): Promise<string | undefined> {
  try {
    return await readFile(filePath, 'utf-8')
  } catch {
    return undefined
  }
}

async function readProjectWorkflow(
  repoRoot: string,
  workflowId: string,
): Promise<WorkflowDefinition | undefined> {
  const base = path.join(repoRoot, '.agents', 'workflows', workflowId)
  const content =
    (await readOptionalFile(`${base}.yaml`)) ??
    (await readOptionalFile(`${base}.yml`))

  if (!content) return undefined

  const parsed = parseYaml(content) as unknown
  return WorkflowDefinitionSchema.parse(parsed)
}

export async function loadWorkflowDefinition(
  input: LoadWorkflowInput,
): Promise<WorkflowDefinition> {
  const workflowId = input.workflowId ?? 'bugfix'
  const projectWorkflow = await readProjectWorkflow(input.repoRoot, workflowId)

  if (projectWorkflow) {
    return projectWorkflow
  }

  const builtin = getBuiltinWorkflow(workflowId)

  if (builtin) {
    return builtin
  }

  throw new Error(`Workflow not found: ${workflowId}`)
}
