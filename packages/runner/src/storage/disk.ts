import { mkdir, statfs } from 'node:fs/promises'
import { resolve } from 'node:path'
import { createForgeAgentError } from '@forgeagent/core'

export interface DiskSpaceInfo {
  path: string
  availableBytes: number
  blockSize: number
  freeBlocks: number
}

export type StatfsLike = (
  path: string,
) => Promise<{ bsize: number | bigint; bavail: number | bigint }>

export interface DiskSpaceServiceOptions {
  statfsImpl?: StatfsLike
}

export class DiskSpaceService {
  private readonly statfsImpl: StatfsLike

  constructor(options: DiskSpaceServiceOptions = {}) {
    this.statfsImpl = options.statfsImpl || (statfs as unknown as StatfsLike)
  }

  async getAvailable(path: string): Promise<DiskSpaceInfo> {
    const target = resolve(path)
    await mkdir(target, { recursive: true })

    const stats = await this.statfsImpl(target)
    const blockSize = Number(stats.bsize)
    const freeBlocks = Number(stats.bavail)
    const availableBytes = blockSize * freeBlocks

    return {
      path: target,
      availableBytes,
      blockSize,
      freeBlocks,
    }
  }

  async assertMinFree(path: string, minFreeBytes: number): Promise<void> {
    const info = await this.getAvailable(path)

    if (info.availableBytes < minFreeBytes) {
      throw createForgeAgentError(
        'DISK_SPACE_LOW',
        'Not enough free disk space for creating a task worktree',
        {
          path: info.path,
          availableBytes: info.availableBytes,
          minFreeBytes,
          hint: 'Free disk space or run `forgeagent task cleanup` / `forgeagent task discard <taskId>` before creating more tasks.',
        },
      )
    }
  }
}
