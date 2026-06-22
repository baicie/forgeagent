import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { resolve } from 'node:path'
import type { GitClient } from './gitClient'
import type { GitDiffService } from './diff'

export class GitPatchService {
  constructor(
    private readonly gitClient: GitClient,
    private readonly diffService: GitDiffService,
  ) {}

  async createPatchFromWorktree(
    taskId: string,
    worktreePath: string,
    dataDir: string,
  ): Promise<string> {
    const patchDir = resolve(dataDir, 'patches')
    const patchFile = resolve(patchDir, `${taskId}.patch`)
    const diff = await this.diffService.getDiff(worktreePath)

    await mkdir(patchDir, { recursive: true })
    await writeFile(patchFile, diff, 'utf-8')

    return patchFile
  }

  async applyPatch(gitRoot: string, patchFile: string): Promise<void> {
    await readFile(patchFile, 'utf-8')

    await this.gitClient.run(['apply', '--whitespace=nowarn', patchFile], {
      cwd: gitRoot,
    })
  }
}
