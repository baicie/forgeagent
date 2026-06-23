import type { CommandRiskLevel, Task } from '@forgeagent/core'
import { assertInsideWorkspace, classifyCommandRisk } from '@forgeagent/core'

export interface CommandPolicyEvaluation {
  command: string
  risk: CommandRiskLevel
  reasons: string[]
  requiresApproval: true
  riskColor: 'green' | 'yellow' | 'orange' | 'red'
  timeoutMs: number
}

export interface ResolveCommandCwdInput {
  task: Task
  cwd?: string
}

export const DEFAULT_APPROVED_COMMAND_TIMEOUT_MS = 120_000

export function getCommandRiskColor(
  risk: CommandRiskLevel,
): CommandPolicyEvaluation['riskColor'] {
  switch (risk) {
    case 'dangerous':
      return 'red'

    case 'high':
      return 'orange'

    case 'medium':
      return 'yellow'

    case 'low':
      return 'green'
  }
}

export class CommandPolicy {
  evaluate(command: string): CommandPolicyEvaluation {
    const risk = classifyCommandRisk(command)

    return {
      command,
      risk: risk.level,
      reasons: risk.reasons,
      requiresApproval: true,
      riskColor: getCommandRiskColor(risk.level),
      timeoutMs: DEFAULT_APPROVED_COMMAND_TIMEOUT_MS,
    }
  }

  resolveCwd(input: ResolveCommandCwdInput): string {
    return assertInsideWorkspace(input.task.worktreePath, input.cwd || '.')
  }
}
