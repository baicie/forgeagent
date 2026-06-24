import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { DiskSpaceService } from './disk'

describe('diskSpaceService', () => {
  it('reads available disk space', async () => {
    const tempDir = await mkdtemp(join(tmpdir(), 'forgeagent-disk-'))

    try {
      const service = new DiskSpaceService()
      const info = await service.getAvailable(tempDir)

      expect(info.path).toBe(tempDir)
      expect(info.availableBytes).toBeGreaterThan(0)
    } finally {
      await rm(tempDir, { recursive: true, force: true })
    }
  })

  it('throws DISK_SPACE_LOW when available bytes are below threshold', async () => {
    const tempDir = await mkdtemp(join(tmpdir(), 'forgeagent-disk-low-'))

    try {
      const service = new DiskSpaceService({
        statfsImpl: (async () => ({
          bsize: 1024,
          bavail: 1,
        })) as never,
      })

      await expect(
        service.assertMinFree(tempDir, 2048),
      ).rejects.toMatchObject({
        code: 'DISK_SPACE_LOW',
        details: {
          hint: expect.stringContaining('forgeagent task cleanup'),
        },
      })
    } finally {
      await rm(tempDir, { recursive: true, force: true })
    }
  })
})
