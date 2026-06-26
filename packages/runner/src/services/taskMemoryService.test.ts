import type { Task } from '@forgeagent/core'
import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { loadRunnerConfig } from '../config'
import { createInMemoryRunnerDb } from '../db'
import { EventService } from './eventService'
import { TaskMemoryService } from './taskMemoryService'

function createTask(overrides: Partial<Task> = {}): Task {
  const now = new Date().toISOString()

  return {
    id: 'task_1',
    workspaceId: 'ws_1',
    prompt: 'Fix the bug',
    status: 'created',
    baseBranch: 'main',
    baseCommit: 'a'.repeat(40),
    worktreePath: '/tmp/worktree',
    createdAt: now,
    updatedAt: now,
    ...overrides,
  }
}

describe('taskMemoryService', () => {
  let dataDir: string
  let service: TaskMemoryService
  let eventService: EventService

  beforeEach(async () => {
    dataDir = await mkdtemp(join(tmpdir(), 'forgeagent-memory-'))
    const db = createInMemoryRunnerDb()
    eventService = new EventService(db)
    service = new TaskMemoryService(loadRunnerConfig({ dataDir }), eventService)
  })

  afterEach(async () => {
    await rm(dataDir, { recursive: true, force: true })
  })

  it('initializes all task memory files', async () => {
    const task = createTask()

    await service.initializeTaskMemory(task)

    const snapshot = await service.readTaskMemory(task.id)

    expect(snapshot.files.map(file => file.file)).toEqual([
      'task_plan.md',
      'progress.md',
      'findings.md',
      'decisions.md',
      'changed_files.md',
      'test_results.md',
      'context_pack.md',
      'final_summary.md',
      'review_report.md',
    ])
    expect(
      snapshot.files.find(file => file.file === 'task_plan.md')?.content,
    ).toContain('Fix the bug')
  })

  it('appends status changes to progress', async () => {
    const task = createTask()

    await service.initializeTaskMemory(task)
    await service.recordStatusChange({
      task,
      previousStatus: 'created',
      status: 'running',
      reason: 'Starting agent loop',
    })

    const progress = await service.readTaskMemoryFile(task.id, 'progress.md')

    expect(progress.content).toContain('Status: running')
    expect(progress.content).toContain('Starting agent loop')
  })

  it('records search_text findings', async () => {
    const task = createTask()

    await service.initializeTaskMemory(task)
    await service.recordToolResult({
      taskId: task.id,
      toolName: 'search_text',
      args: {
        query: 'Git command failed',
      },
      result: {
        matches: [
          {
            path: 'src/git.ts',
            line: 12,
            text: 'throw new Error("Git command failed")',
          },
        ],
      },
    })

    const findings = await service.readTaskMemoryFile(task.id, 'findings.md')

    expect(findings.content).toContain('Search: Git command failed')
    expect(findings.content).toContain('src/git.ts:12')
  })

  it('records apply_patch changed files and decisions', async () => {
    const task = createTask()

    await service.initializeTaskMemory(task)
    await service.recordToolResult({
      taskId: task.id,
      toolName: 'apply_patch',
      args: {},
      result: {
        changedFiles: ['packages/runner/src/foo.ts'],
      },
    })

    const changedFiles = await service.readTaskMemoryFile(
      task.id,
      'changed_files.md',
    )
    const decisions = await service.readTaskMemoryFile(task.id, 'decisions.md')

    expect(changedFiles.content).toContain('packages/runner/src/foo.ts')
    expect(decisions.content).toContain('Agent applied a patch')
  })

  it('records command results into test_results', async () => {
    const task = createTask()

    await service.initializeTaskMemory(task)
    await service.recordCommandResult({
      taskId: task.id,
      command: 'pnpm test:run',
      cwd: task.worktreePath,
      ok: false,
      exitCode: 1,
      stdout: 'ok',
      stderr: 'failed',
    })

    const testResults = await service.readTaskMemoryFile(
      task.id,
      'test_results.md',
    )

    expect(testResults.content).toContain('pnpm test:run')
    expect(testResults.content).toContain('Exit code: 1')
    expect(testResults.content).toContain('failed')
  })

  it('deletes task memory directory', async () => {
    const task = createTask()

    await service.initializeTaskMemory(task)
    await service.deleteTaskMemory(task.id)

    await expect(service.readTaskMemory(task.id)).rejects.toThrow()
  })

  it('self-heals missing task memory files for legacy tasks', async () => {
    const task = createTask()

    await service.ensureTaskMemory(task)

    const snapshot = await service.readTaskMemory(task.id)

    expect(snapshot.files).toHaveLength(9)
    expect(
      snapshot.files.find(file => file.file === 'task_plan.md')?.content,
    ).toContain('Fix the bug')
  })

  it('records undefined final summary without crashing', async () => {
    const task = createTask()

    await service.initializeTaskMemory(task)
    await service.recordFinalSummary({
      taskId: task.id,
      message: 'done',
      summary: undefined,
    })

    const finalSummary = await service.readTaskMemoryFile(
      task.id,
      'final_summary.md',
    )

    expect(finalSummary.content).toContain('done')
    expect(finalSummary.content).toContain('{}')
  })
})
