import type { Task, Workspace } from '@forgeagent/core'
import { mkdir, mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { createInMemoryRunnerDb } from '../db'
import { EventService } from '../services/eventService'
import type { WorkspaceService } from '../services/workspaceService'
import { WorkflowService } from './workflowService'

function createTask(worktreePath: string): Task {
  return {
    id: 'task_1',
    workspaceId: 'ws_1',
    prompt: 'fix bug',
    status: 'running',
    workflowId: 'bugfix',
    baseBranch: 'main',
    baseCommit: 'a'.repeat(40),
    worktreePath,
    createdAt: '2026-06-26T00:00:00.000Z',
    updatedAt: '2026-06-26T00:00:00.000Z',
  }
}

describe('workflow service', () => {
  let tempDir: string

  beforeEach(async () => {
    tempDir = await mkdtemp(path.join(tmpdir(), 'forgeagent-workflow-service-'))
    await mkdir(tempDir, { recursive: true })
  })

  afterEach(async () => {
    await rm(tempDir, { recursive: true, force: true })
  })

  it('starts task workflow', async () => {
    const db = createInMemoryRunnerDb()
    const eventService = new EventService(db)
    const workspaceService = {
      get: () =>
        ({
          id: 'ws_1',
          name: 'repo',
          repoPath: tempDir,
          gitRoot: tempDir,
          currentBranch: 'main',
          currentCommit: 'a'.repeat(40),
          createdAt: '2026-06-26T00:00:00.000Z',
          updatedAt: '2026-06-26T00:00:00.000Z',
        }) satisfies Workspace,
    } as unknown as WorkspaceService

    const service = new WorkflowService(workspaceService, eventService)
    const run = await service.startTaskWorkflow({ task: createTask(tempDir) })

    expect(run.workflowId).toBe('bugfix')
    expect(run.currentStepId).toBe('context')
    expect(run.status).toBe('pending')
    expect(
      db.state.events.some(event => event.type === 'workflow.started'),
    ).toBe(true)
  })

  it('does not restart if workflow already exists', async () => {
    const db = createInMemoryRunnerDb()
    const eventService = new EventService(db)
    const workspaceService = {
      get: () => ({ id: 'ws_1', gitRoot: tempDir }),
    } as unknown as WorkspaceService
    const service = new WorkflowService(workspaceService, eventService)
    const task = createTask(tempDir)

    const run1 = await service.startTaskWorkflow({ task })
    const run2 = await service.startTaskWorkflow({ task })

    expect(run1).toBe(run2)
    expect(
      db.state.events.filter(e => e.type === 'workflow.started'),
    ).toHaveLength(1)
  })

  it('moves through workflow steps', async () => {
    const db = createInMemoryRunnerDb()
    const eventService = new EventService(db)
    const workspaceService = {
      get: () => ({ id: 'ws_1', gitRoot: tempDir }),
    } as unknown as WorkspaceService
    const service = new WorkflowService(workspaceService, eventService)
    const task = createTask(tempDir)

    await service.startTaskWorkflow({ task })
    await service.startCurrentStep(task.id)
    const run = await service.finishCurrentStep({ taskId: task.id })

    expect(run.currentStepId).toBe('plan')
    expect(
      db.state.events.some(event => event.type === 'workflow.step.finished'),
    ).toBe(true)
  })

  it('finishes all steps and marks workflow completed', async () => {
    const db = createInMemoryRunnerDb()
    const eventService = new EventService(db)
    const workspaceService = {
      get: () => ({ id: 'ws_1', gitRoot: tempDir }),
    } as unknown as WorkspaceService
    const service = new WorkflowService(workspaceService, eventService)
    const task = createTask(tempDir)

    await service.startTaskWorkflow({ task })

    for (let i = 0; i < 6; i++) {
      await service.startCurrentStep(task.id)
      await service.finishCurrentStep({ taskId: task.id })
    }

    const run = service.getRun(task.id)
    expect(run?.status).toBe('completed')
    expect(
      db.state.events.some(event => event.type === 'workflow.finished'),
    ).toBe(true)
  })

  it('enforces tool allow list', async () => {
    const db = createInMemoryRunnerDb()
    const eventService = new EventService(db)
    const workspaceService = {
      get: () => ({ id: 'ws_1', gitRoot: tempDir }),
    } as unknown as WorkspaceService
    const service = new WorkflowService(workspaceService, eventService)
    const task = createTask(tempDir)

    await service.startTaskWorkflow({ task })
    await service.finishCurrentStep({ taskId: task.id }) // context
    await service.finishCurrentStep({ taskId: task.id }) // plan

    // now at edit step (currentStepId = 'edit')
    // edit step allows read_file
    expect(() => service.assertToolAllowed(task.id, 'read_file')).not.toThrow()
    // but not run_command
    expect(() => service.assertToolAllowed(task.id, 'run_command')).toThrow(
      'not allowed',
    )
  })

  it('throws when no current step for tool check', async () => {
    const db = createInMemoryRunnerDb()
    const eventService = new EventService(db)
    const workspaceService = {
      get: () => ({ id: 'ws_1', gitRoot: tempDir }),
    } as unknown as WorkspaceService
    const service = new WorkflowService(workspaceService, eventService)
    const task = createTask(tempDir)

    await service.startTaskWorkflow({ task })

    // no step started yet, step.tools.length === 0 -> no check
    expect(() =>
      service.assertToolAllowed(task.id, 'run_command'),
    ).not.toThrow()
  })

  it('returns undefined for missing run', () => {
    const db = createInMemoryRunnerDb()
    const eventService = new EventService(db)
    const workspaceService = {} as unknown as WorkspaceService
    const service = new WorkflowService(workspaceService, eventService)

    expect(service.getRun('nonexistent')).toBeUndefined()
    expect(service.getCurrentStep('nonexistent')).toBeUndefined()
  })
})
