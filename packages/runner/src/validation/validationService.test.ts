import type { Task } from '@forgeagent/core'
import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { loadRunnerConfig } from '../config'
import { createInMemoryRunnerDb } from '../db'
import { ApprovalService } from '../services/approvalService'
import { AuditService } from '../services/auditService'
import { EventService } from '../services/eventService'
import { TaskMemoryService } from '../services/taskMemoryService'
import { ValidationService } from './validationService'

function createTask(worktreePath: string): Task {
  return {
    id: 'task_1',
    workspaceId: 'ws_1',
    prompt: 'fix bug',
    status: 'running',
    baseBranch: 'main',
    baseCommit: 'a'.repeat(40),
    worktreePath,
    createdAt: '2026-06-25T00:00:00.000Z',
    updatedAt: '2026-06-25T00:00:00.000Z',
  }
}

describe('validation service', () => {
  let tempDir: string

  beforeEach(async () => {
    tempDir = await mkdtemp(
      path.join(tmpdir(), 'forgeagent-validation-service-'),
    )
  })

  afterEach(async () => {
    await rm(tempDir, { recursive: true, force: true })
  })

  it('creates plan and requests validation approval', async () => {
    await mkdir(path.join(tempDir, '.agents'), { recursive: true })
    await writeFile(
      path.join(tempDir, '.agents/validation.yaml'),
      'validation:\n  commands:\n    - pnpm typecheck\n  maxFixAttempts: 2\n',
    )

    const db = createInMemoryRunnerDb()
    const eventService = new EventService(db)
    const auditService = new AuditService(db)
    const approvalService = new ApprovalService(db, eventService, auditService)
    const memoryService = new TaskMemoryService(
      loadRunnerConfig({ dataDir: path.join(tempDir, 'data') }),
      eventService,
    )
    const task = createTask(tempDir)

    await memoryService.initializeTaskMemory(task)

    const service = new ValidationService(
      approvalService,
      eventService,
      memoryService,
    )

    const plan = await service.createPlan({ task })

    expect(plan.commands.map(command => command.command)).toEqual([
      'pnpm typecheck',
    ])

    const updated = await service.requestNextValidation({ task, plan })

    expect(updated.status).toBe('waiting_approval')
    expect(approvalService.list()).toHaveLength(1)
    expect(approvalService.list()[0].command).toBe('pnpm typecheck')
  })

  it('records failed validation and creates failure summary', async () => {
    const db = createInMemoryRunnerDb()
    const eventService = new EventService(db)
    const auditService = new AuditService(db)
    const approvalService = new ApprovalService(db, eventService, auditService)
    const memoryService = new TaskMemoryService(
      loadRunnerConfig({ dataDir: path.join(tempDir, 'data') }),
      eventService,
    )
    const task = createTask(tempDir)

    await memoryService.initializeTaskMemory(task)

    const service = new ValidationService(
      approvalService,
      eventService,
      memoryService,
    )

    const plan = await service.createPlan({
      task,
      taskValidation: {
        commands: ['pnpm test'],
        maxFixAttempts: 1,
      },
    })

    const waiting = await service.requestNextValidation({ task, plan })
    const approvalId = waiting.results[0].approvalId

    const failed = await service.recordCommandResult({
      taskId: task.id,
      command: 'pnpm test',
      cwd: tempDir,
      ok: false,
      approvalId,
      exitCode: 1,
      stderr: 'Type error: missing property',
    })

    expect(failed?.status).toBe('failed')

    const summary = service.summarize(failed!)

    expect(summary.failureSummary).toContain('pnpm test')
    expect(summary.failureSummary).toContain('Type error')
  })

  it('records passed validation result', async () => {
    const db = createInMemoryRunnerDb()
    const eventService = new EventService(db)
    const auditService = new AuditService(db)
    const approvalService = new ApprovalService(db, eventService, auditService)
    const memoryService = new TaskMemoryService(
      loadRunnerConfig({ dataDir: path.join(tempDir, 'data') }),
      eventService,
    )
    const task = createTask(tempDir)

    await memoryService.initializeTaskMemory(task)

    const service = new ValidationService(
      approvalService,
      eventService,
      memoryService,
    )

    const plan = await service.createPlan({
      task,
      taskValidation: {
        commands: ['pnpm typecheck'],
      },
    })

    const waiting = await service.requestNextValidation({ task, plan })
    const approvalId = waiting.results[0].approvalId

    const passed = await service.recordCommandResult({
      taskId: task.id,
      command: 'pnpm typecheck',
      cwd: tempDir,
      ok: true,
      approvalId,
      exitCode: 0,
      stdout: 'No errors',
    })

    expect(passed?.status).toBe('passed')
    expect(passed?.results[0].status).toBe('passed')
  })

  it('increments fixAttempt on markFixAttempt', async () => {
    const db = createInMemoryRunnerDb()
    const eventService = new EventService(db)
    const auditService = new AuditService(db)
    const approvalService = new ApprovalService(db, eventService, auditService)
    const memoryService = new TaskMemoryService(
      loadRunnerConfig({ dataDir: path.join(tempDir, 'data') }),
      eventService,
    )
    const task = createTask(tempDir)

    await memoryService.initializeTaskMemory(task)

    const service = new ValidationService(
      approvalService,
      eventService,
      memoryService,
    )

    const plan = await service.createPlan({
      task,
      taskValidation: {
        commands: ['pnpm test'],
        maxFixAttempts: 3,
      },
    })

    expect(plan.fixAttempt).toBe(0)

    const marked = service.markFixAttempt(task.id)

    expect(marked?.fixAttempt).toBe(1)
    expect(marked?.status).toBe('pending')
    expect(marked?.results).toEqual([])
  })

  it('returns empty feedback prompt when validation passed', async () => {
    const db = createInMemoryRunnerDb()
    const eventService = new EventService(db)
    const auditService = new AuditService(db)
    const approvalService = new ApprovalService(db, eventService, auditService)
    const memoryService = new TaskMemoryService(
      loadRunnerConfig({ dataDir: path.join(tempDir, 'data') }),
      eventService,
    )
    const task = createTask(tempDir)

    await memoryService.initializeTaskMemory(task)

    const service = new ValidationService(
      approvalService,
      eventService,
      memoryService,
    )

    await service.createPlan({
      task,
      taskValidation: {
        commands: ['pnpm typecheck'],
        maxFixAttempts: 3,
      },
    })

    await service.recordCommandResult({
      taskId: task.id,
      command: 'pnpm typecheck',
      cwd: tempDir,
      ok: true,
      exitCode: 0,
    })

    const currentPlan = service.getPlan(task.id)!
    const feedback = service.createFeedbackPrompt(currentPlan)

    expect(feedback).toBe('')
  })
})
