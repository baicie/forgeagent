import type { WorkflowDefinition } from '@forgeagent/core'
import { WorkflowDefinitionSchema } from '@forgeagent/core'

export const BUGFIX_WORKFLOW: WorkflowDefinition =
  WorkflowDefinitionSchema.parse({
    id: 'bugfix',
    name: 'Bugfix Workflow',
    steps: [
      {
        id: 'context',
        type: 'context_pack',
        output: 'context_pack.md',
      },
      {
        id: 'plan',
        type: 'llm',
        memory: {
          write: ['task_plan.md', 'decisions.md'],
        },
      },
      {
        id: 'edit',
        type: 'agent_loop',
        tools: ['read_file', 'search_text', 'apply_patch', 'get_diff'],
        memory: {
          write: ['progress.md', 'findings.md', 'changed_files.md'],
        },
      },
      {
        id: 'validate',
        type: 'validation',
        approval: 'required',
        memory: {
          write: ['test_results.md'],
        },
      },
      {
        id: 'review',
        type: 'readonly_review',
      },
      {
        id: 'final_approval',
        type: 'approval',
        actions: ['apply', 'commit', 'discard'],
      },
    ],
  })

export const BUILTIN_WORKFLOWS = [BUGFIX_WORKFLOW]

export function getBuiltinWorkflow(id: string): WorkflowDefinition | undefined {
  return BUILTIN_WORKFLOWS.find(workflow => workflow.id === id)
}
