import type { Approval } from '@forgeagent/core'
import type { ApprovalService } from '../services/approvalService'
import type { AuditService } from '../services/auditService'
import type { EventService } from '../services/eventService'
import type { TaskMemoryService } from '../services/taskMemoryService'
import type { TaskService } from '../services/taskService'
import type { CommandPolicy, CommandPolicyEvaluation } from './commandPolicy'
import type { ShellExecutor, ShellExecutionResult } from './shellExecutor'
import type { ValidationService } from '../validation/validationService'

export interface ApprovalGateOptions {
  approvalService: ApprovalService
  taskService: TaskService
  eventService: EventService
  auditService: AuditService
  shellExecutor: ShellExecutor
  commandPolicy: CommandPolicy
  taskMemoryService?: TaskMemoryService
  validationService?: ValidationService
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
        displayName: 'run',
        source: 'core',
        type: 'execute',
        permission: 'requires_approval',
        requiresApproval: true,
        approvalStatus: 'approved',
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
        riskColor: policy.riskColor,
      },
    })

    const outputWrites: Array<Promise<unknown>> = []
    let outputWriteError: unknown

    let result: ShellExecutionResult

    try {
      result = await this.options.shellExecutor.execute({
        command: approval.command,
        cwd,
        timeoutMs: policy.timeoutMs,
        onOutput: chunk => {
          const write = this.options.eventService
            .append({
              taskId: approval.taskId,
              type: 'tool.output',
              payload: {
                toolCallId: approval.toolCallId,
                toolName: 'run_command',
                command: approval.command,
                stream: chunk.stream,
                chunk: chunk.chunk,
              },
            })
            .catch(error => {
              outputWriteError = outputWriteError ?? error
            })

          outputWrites.push(write)
        },
      })
    } catch (shellError) {
      result = {
        ok: false,
        command: approval.command,
        cwd,
        exitCode: null,
        signal: null,
        timedOut: false,
        stdout: '',
        stderr: '',
        error:
          shellError instanceof Error ? shellError.message : String(shellError),
        startedAt: new Date().toISOString(),
        finishedAt: new Date().toISOString(),
      }
    }

    await Promise.all(outputWrites)

    if (outputWriteError) {
      throw outputWriteError
    }

    await this.options.eventService.append({
      taskId: approval.taskId,
      type: 'tool.finished',
      payload: {
        toolCallId: approval.toolCallId,
        toolName: 'run_command',
        displayName: 'run',
        source: 'core',
        type: 'execute',
        permission: 'requires_approval',
        requiresApproval: true,
        approvalStatus: 'approved',
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
        error: result.error,
      },
    })

    await this.options.taskMemoryService?.recordCommandResult({
      taskId: approval.taskId,
      command: approval.command,
      cwd,
      ok: result.ok,
      exitCode: result.exitCode,
      timedOut: result.timedOut,
      stdout: result.stdout,
      stderr: result.stderr,
      error: result.error,
    })

    await this.options.validationService?.recordCommandResult({
      taskId: approval.taskId,
      command: approval.command,
      cwd,
      ok: result.ok,
      approvalId: approval.id,
      exitCode: result.exitCode,
      timedOut: result.timedOut,
      stdout: result.stdout,
      stderr: result.stderr,
      error: result.error,
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
        displayName: 'run',
        source: 'core',
        type: 'execute',
        permission: 'requires_approval',
        requiresApproval: true,
        approvalStatus: 'denied',
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

    await this.options.taskMemoryService?.recordCommandResult({
      taskId: approval.taskId,
      command: approval.command,
      cwd: approval.cwd,
      ok: false,
      rejected: true,
      reason,
    })

    await this.options.validationService?.recordCommandResult({
      taskId: approval.taskId,
      command: approval.command,
      cwd: approval.cwd,
      ok: false,
      approvalId: approval.id,
      error: reason ?? 'Command rejected by user',
    })

    return {
      approval: rejected,
      result,
    }
  }

  private async resumeTaskIfWaitingApproval(
    taskId: string,
    reason: string,
  ): Promise<void> {
    const task = this.options.taskService.get(taskId)

    if (task.status === 'waiting_approval') {
      await this.options.taskService.resume(taskId, reason)
    }
  }
}
