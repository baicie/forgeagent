import { loadRunnerConfig } from '../config'
import { createInMemoryRunnerDb } from '../db'
import type { GitDiffService } from '../git/diff'
import type { GitRepositoryService } from '../git/repository'
import type { GitWorktreeService } from '../git/worktree'
import type { AuditService } from './auditService'
import { EventService } from './eventService'
import { TaskService } from './taskService'
import type { WorkspaceService } from './workspaceService'

describe('taskService', () => {
  describe('create()', () => {
    it('cleans up worktree and in-memory records when audit append fails', async () => {
      const workspace = {
        id: 'ws_1',
        name: 'test-repo',
        repoPath: '/repo',
        gitRoot: '/repo',
        createdAt: '2026-06-22T00:00:00.000Z',
        updatedAt: '2026-06-22T00:00:00.000Z',
      }

      const db = createInMemoryRunnerDb({
        workspaces: [workspace],
        tasks: [],
        events: [],
        approvals: [],
        audits: [],
      })

      const workspaceService = {
        get: vi.fn(() => workspace),
      } as unknown as WorkspaceService

      const gitRepositoryService = {
        getRepositoryInfo: vi.fn(async () => ({
          repoPath: '/repo',
          gitRoot: '/repo',
          currentBranch: 'main',
          currentCommit: 'a'.repeat(40),
          isDirty: false,
        })),
      } as unknown as GitRepositoryService

      const gitWorktreeService = {
        create: vi.fn(async () => ({
          worktreePath: '/tmp/forgeagent/worktrees/task_abc',
          branchName: 'forgeagent/task-task_abc',
        })),
        discard: vi.fn(async () => {}),
      } as unknown as GitWorktreeService

      const gitDiffService = {
        getDiff: vi.fn(async () => ''),
      } as unknown as GitDiffService

      const eventService = new EventService(db)

      const auditService = {
        append: vi.fn(async () => {
          throw new Error('audit failed')
        }),
      } as unknown as AuditService

      const taskService = new TaskService(
        db,
        loadRunnerConfig({ dataDir: '/tmp/forgeagent' }),
        workspaceService,
        gitRepositoryService,
        gitWorktreeService,
        gitDiffService,
        eventService,
        auditService,
      )

      await expect(
        taskService.create({
          workspaceId: workspace.id,
          prompt: 'fix the bug',
        }),
      ).rejects.toThrow('audit failed')

      // The discard should have been called to clean up the worktree.
      expect(gitWorktreeService.discard).toHaveBeenCalledTimes(1)
      const discardCall = (
        gitWorktreeService.discard as ReturnType<typeof vi.fn>
      ).mock.calls[0]
      expect(discardCall[0]).toBe('/repo')
      expect(discardCall[1]).toBe('/tmp/forgeagent/worktrees/task_abc')
      expect(discardCall[2]).toMatch(/^task_/)

      // No orphaned records should remain in the in-memory DB.
      expect(db.state.tasks).toEqual([])
      expect(db.state.events).toEqual([])
      expect(db.state.audits).toEqual([])
      expect(db.state.approvals).toEqual([])
    })

    it('cleans up worktree and in-memory records when db.save() fails after task push', async () => {
      const workspace = {
        id: 'ws_2',
        name: 'test-repo-2',
        repoPath: '/repo2',
        gitRoot: '/repo2',
        createdAt: '2026-06-22T00:00:00.000Z',
        updatedAt: '2026-06-22T00:00:00.000Z',
      }

      const db = createInMemoryRunnerDb({
        workspaces: [workspace],
        tasks: [],
        events: [],
        approvals: [],
        audits: [],
      })

      // Make db.save() fail after the task has been pushed.
      let firstSave = false
      vi.spyOn(db, 'save').mockImplementation(async () => {
        if (!firstSave) {
          firstSave = true
          return
        }
        throw new Error('db save failed')
      })

      const workspaceService = {
        get: vi.fn(() => workspace),
      } as unknown as WorkspaceService

      const gitRepositoryService = {
        getRepositoryInfo: vi.fn(async () => ({
          repoPath: '/repo2',
          gitRoot: '/repo2',
          currentBranch: 'main',
          currentCommit: 'b'.repeat(40),
          isDirty: false,
        })),
      } as unknown as GitRepositoryService

      const gitWorktreeService = {
        create: vi.fn(async () => ({
          worktreePath: '/tmp/forgeagent/worktrees/task_def',
          branchName: 'forgeagent/task-task_def',
        })),
        discard: vi.fn(async () => {}),
      } as unknown as GitWorktreeService

      const gitDiffService = {
        getDiff: vi.fn(async () => ''),
      } as unknown as GitDiffService

      const eventService = new EventService(db)

      const auditService = {
        append: vi.fn(async () => {}),
      } as unknown as AuditService

      const taskService = new TaskService(
        db,
        loadRunnerConfig({ dataDir: '/tmp/forgeagent' }),
        workspaceService,
        gitRepositoryService,
        gitWorktreeService,
        gitDiffService,
        eventService,
        auditService,
      )

      await expect(
        taskService.create({
          workspaceId: workspace.id,
          prompt: 'fix bug 2',
        }),
      ).rejects.toThrow('db save failed')

      // discard was called for cleanup
      expect(gitWorktreeService.discard).toHaveBeenCalledTimes(1)
      expect(db.state.tasks).toEqual([])
    })
  })
})
