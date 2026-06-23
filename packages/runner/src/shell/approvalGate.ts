import type { Approval } from '@forgeagent/core'
import type { ApprovalService } from '../services/approvalService'
import type { AuditService } from '../services/auditService'
import type { EventService } from '../services/eventService'
import type { TaskService } from '../services/taskService'
import type { CommandPolicy, CommandPolicyEvaluation } from './commandPolicy'
import type { ShellExecutor, ShellExecutionResult } from './shellExecutor'

export interface ApprovalGateOptions {
  approvalService: ApprovalService
  taskService: TaskService
  eventService: EventService
  auditService: AuditService
  shellExecutor: ShellExecutor
  commandPolicy: CommandPolicy
}

export interface RejectedCommandResult {
  ok: false
  rejected: true
  approvalId: string
  command: string
  reason?: string
}

export interface ApprovedCommandResponse {
  approval: Approval
  policy: CommandPolicyEvaluation
  result: ShellExecutionResult
}

export interface RejectedCommandResponse {
  approval: Approval
  result: RejectedCommandResult
}

export class ApprovalGate {
  constructor(private readonly options: ApprovalGateOptions) {}

  async approve(approvalId: string): Promise<ApprovedCommandResponse> {
    const approval = this.options.approvalService.get(approvalId)
    const task = this.options.taskService.get(approval.taskId)
    const policy = this.options.commandPolicy.evaluate(approval.command)
    const cwd = this.options.commandPolicy.resolveCwd({
      task,
      cwd: approval.cwd,
    })

    const approved = await this.options.approvalService.approve(approvalId)

    await this.resumeTaskIfWaitingApproval(approval.taskId, 'Command approved')

    await this.options.eventService.append({
      taskId: approval.taskId,
      type: 'tool.started',
      payload: {
        toolCallId: approval.toolCallId,
        toolName: 'run_command',
        command: approval.command,
        cwd,
        approvalId: approval.id,
        risk: policy.risk,
        riskColor: policy.riskColor,
      },
    })

    await this.options.auditService.append({
      taskId: approval.taskId,
      type: 'command.started',
      payload: {
        approvalId: approval.id,
        toolCallId: approval.toolCallId,
        command: approval.command,
        cwd,
        risk: policy.risk,
      },
    })

    const outputWrites: Array<Promise<unknown>> = []

    const result = await this.options.shellExecutor.execute({
      command: approval.command,
      cwd,
      timeoutMs: policy.timeoutMs,
      onOutput: chunk => {
        outputWrites.push(
          this.options.eventService.append({
            taskId: approval.taskId,
            type: 'tool.output',
            payload: {
              toolCallId: approval.toolCallId,
              toolName: 'run_command',
              command: approval.command,
              stream: chunk.stream,
              chunk: chunk.chunk,
            },
          }),
        )
      },
    })

    await Promise.all(outputWrites)

    await this.options.eventService.append({
      taskId: approval.taskId,
      type: 'tool.finished',
      payload: {
        toolCallId: approval.toolCallId,
        toolName: 'run_command',
        command: approval.command,
        ok: result.ok,
        result,
      },
    })

    await this.options.auditService.append({
      taskId: approval.taskId,
      type: 'command.finished',
      payload: {
        approvalId: approval.id,
        toolCallId: approval.toolCallId,
        command: approval.command,
        cwd,
        ok: result.ok,
        exitCode: result.exitCode,
        signal: result.signal,
        timedOut: result.timedOut,
      },
    })

    return {
      approval: approved,
      policy,
      result,
    }
  }

  async reject(
    approvalId: string,
    reason?: string,
  ): Promise<RejectedCommandResponse> {
    const approval = this.options.approvalService.get(approvalId)
    const rejected = await this.options.approvalService.reject(approvalId)

    await this.resumeTaskIfWaitingApproval(approval.taskId, 'Command rejected')

    const result: RejectedCommandResult = {
      ok: false,
      rejected: true,
      approvalId: approval.id,
      command: approval.command,
      reason,
    }

    await this.options.eventService.append({
      taskId: approval.taskId,
      type: 'tool.finished',
      payload: {
        toolCallId: approval.toolCallId,
        toolName: 'run_command',
        command: approval.command,
        ok: false,
        rejected: true,
        result,
      },
    })

    await this.options.auditService.append({
      taskId: approval.taskId,
      type: 'command.finished',
      payload: {
        approvalId: approval.id,
        toolCallId: approval.toolCallId,
        command: approval.command,
        ok: false,
        rejected: true,
        reason,
      },
    })

    return {
      approval: rejected,
      result,
    }
  }

  private async resumeTaskIfWaitingApproval(
    taskId: string,
    _reason: string,
  ): Promise<void> {
    const task = this.options.taskService.get(taskId)

    if (task.status === 'waiting_approval') {
      await this.options.taskService.resume(taskId, 'Command approved')
    }
  }
}
