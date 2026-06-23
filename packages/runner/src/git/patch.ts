import { createForgeAgentError } from '@forgeagent/core'
import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { resolve } from 'node:path'
import type { GitClient } from './gitClient'
import type { GitDiffService } from './diff'

export interface CreatePatchResult {
  patchFile: string
  diff: string
  bytes: number
}

export class GitPatchService {
  constructor(
    private readonly gitClient: GitClient,
    private readonly diffService: GitDiffService,
  ) {}

  async createPatchFromWorktree(
    taskId: string,
    worktreePath: string,
    dataDir: string,
  ): Promise<CreatePatchResult> {
    const patchDir = resolve(dataDir, 'patches')
    const patchFile = resolve(patchDir, `${taskId}.patch`)
    const diff = await this.diffService.getDiff(worktreePath)

    if (diff.trim().length === 0) {
      throw createForgeAgentError('DIFF_EMPTY', 'Task diff is empty', {
        taskId,
        worktreePath,
      })
    }

    await mkdir(patchDir, { recursive: true })
    const patchContent = diff.endsWith('\n') ? diff : `${diff}\n`
    await writeFile(patchFile, patchContent, 'utf-8')

    return {
      patchFile,
      diff: patchContent,
      bytes: Buffer.byteLength(patchContent, 'utf-8'),
    }
  }

  async applyPatch(gitRoot: string, patchFile: string): Promise<void> {
    const patch = await readFile(patchFile, 'utf-8')

    if (patch.trim().length === 0) {
      throw createForgeAgentError('DIFF_EMPTY', 'Patch file is empty', {
        gitRoot,
        patchFile,
      })
    }

    try {
      await this.gitClient.run(['apply', '--whitespace=nowarn', patchFile], {
        cwd: gitRoot,
      })
    } catch (error) {
      throw createForgeAgentError(
        'PATCH_APPLY_FAILED',
        `Failed to apply patch: ${patchFile}`,
        {
          gitRoot,
          patchFile,
          cause: error instanceof Error ? error.message : String(error),
          details:
            typeof error === 'object' && error !== null && 'details' in error
              ? (error as { details: unknown }).details
              : undefined,
        },
      )
    }
  }
}
