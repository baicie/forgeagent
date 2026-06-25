import type { Task, Workspace } from '@forgeagent/core'
import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { loadRunnerConfig } from '../config'
import { createInMemoryRunnerDb } from '../db'
import type { GitDiffService } from '../git/diff'
import { EventService } from '../services/eventService'
import { TaskMemoryService } from '../services/taskMemoryService'
import { ContextPackBuilder } from './contextPackBuilder'

function createTask(worktreePath: string): Task {
  const now = '2026-06-25T00:00:00.000Z'

  return {
    id: 'task_1',
    workspaceId: 'ws_1',
    prompt: 'fix runner diff error',
    status: 'created',
    baseBranch: 'main',
    baseCommit: 'a'.repeat(40),
    worktreePath,
    createdAt: now,
    updatedAt: now,
  }
}

function createWorkspace(gitRoot: string): Workspace {
  return {
    id: 'ws_1',
    name: 'repo',
    repoPath: gitRoot,
    gitRoot,
    createdAt: '2026-06-25T00:00:00.000Z',
    updatedAt: '2026-06-25T00:00:00.000Z',
  }
}

describe('contextPackBuilder', () => {
  let tempDir: string
  let gitRoot: string
  let dataDir: string
  let taskMemoryService: TaskMemoryService

  beforeEach(async () => {
    tempDir = await mkdtemp(path.join(tmpdir(), 'forgeagent-context-pack-'))
    gitRoot = path.join(tempDir, 'repo')
    dataDir = path.join(tempDir, 'data')

    await mkdir(gitRoot, { recursive: true })
    await mkdir(path.join(gitRoot, 'packages/runner/src'), {
      recursive: true,
    })
    await mkdir(path.join(gitRoot, '.agents/rules'), { recursive: true })
    await mkdir(path.join(gitRoot, '.agents/skills/debug'), {
      recursive: true,
    })

    await writeFile(
      path.join(gitRoot, 'AGENTS.md'),
      '# Root AGENTS\n\nDo not edit dist.\n',
      'utf-8',
    )
    await writeFile(
      path.join(gitRoot, '.agents/AGENTS.md'),
      '# Project Agent Rules\n\nPrefer minimal changes.\n',
      'utf-8',
    )
    await writeFile(
      path.join(gitRoot, '.agents/rules/git.md'),
      '# Git Rules\n\nUse worktree only.\n',
      'utf-8',
    )
    await writeFile(
      path.join(gitRoot, '.agents/skills/debug/SKILL.md'),
      '# Debug Skill\n\nCheck diff command.\n',
      'utf-8',
    )
    await writeFile(
      path.join(gitRoot, 'packages/runner/src/diff.ts'),
      'export function getDiff() { throw new Error("Git command failed") }\n',
      'utf-8',
    )
    await writeFile(path.join(gitRoot, '.env'), 'SECRET=abc', 'utf-8')

    const db = createInMemoryRunnerDb()
    const eventService = new EventService(db)

    taskMemoryService = new TaskMemoryService(
      loadRunnerConfig({ dataDir }),
      eventService,
    )
  })

  afterEach(async () => {
    await rm(tempDir, { recursive: true, force: true })
  })

  it('builds and writes context_pack.md from .agents directory', async () => {
    const task = createTask(gitRoot)
    const workspace = createWorkspace(gitRoot)

    await taskMemoryService.initializeTaskMemory(task)
    await taskMemoryService.append({
      taskId: task.id,
      file: 'findings.md',
      heading: 'Known issue',
      content: '- Git diff command can fail.',
    })

    const builder = new ContextPackBuilder(
      loadRunnerConfig({ dataDir, contextPackMaxChars: 20_000 }),
      taskMemoryService,
      {
        getDiff: vi.fn(async () => 'diff --git a/a b/a\n+change\n'),
      } as unknown as GitDiffService,
      {
        maxChars: 20_000,
      },
    )

    const pack = await builder.build({ task, workspace })

    expect(pack.content).toContain('# Context Pack')
    expect(pack.content).toContain('## Task Goal')
    expect(pack.content).toContain('Do not edit dist')
    expect(pack.content).toContain('Project Agent Rules')
    expect(pack.content).toContain('.agents/rules/git.md')
    expect(pack.content).toContain('.agents/skills/debug/SKILL.md')
    expect(pack.content).toContain('Git diff command can fail')
    expect(pack.content).toContain('packages/runner/src/diff.ts')
    expect(pack.content).not.toContain('SECRET=abc')

    const memoryFile = await taskMemoryService.readTaskMemoryFile(
      task.id,
      'context_pack.md',
    )

    expect(memoryFile.content).toBe(pack.content)
  }, 10_000)

  it('respects max chars', async () => {
    const task = createTask(gitRoot)
    const workspace = createWorkspace(gitRoot)

    await taskMemoryService.initializeTaskMemory(task)

    const builder = new ContextPackBuilder(
      loadRunnerConfig({ dataDir, contextPackMaxChars: 3000 }),
      taskMemoryService,
      {
        getDiff: vi.fn(async () => 'a'.repeat(50_000)),
      } as unknown as GitDiffService,
      {
        maxChars: 3000,
      },
    )

    const pack = await builder.build({ task, workspace })

    expect(pack.content.length).toBeLessThanOrEqual(3000)
    expect(pack.truncated).toBe(true)
  })
})
