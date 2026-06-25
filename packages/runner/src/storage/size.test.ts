import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { estimatePathSize } from './size'

describe('estimatePathSize', () => {
  let tempDir: string

  beforeEach(async () => {
    tempDir = await mkdtemp(join(tmpdir(), 'forgeagent-size-'))
  })

  afterEach(async () => {
    await rm(tempDir, { recursive: true, force: true })
  })

  it('returns recursive file size', async () => {
    await mkdir(join(tempDir, 'nested'))
    await writeFile(join(tempDir, 'a.txt'), 'hello')
    await writeFile(join(tempDir, 'nested', 'b.txt'), 'world')

    await expect(estimatePathSize(tempDir)).resolves.toBe(10)
  })

  it('returns 0 for missing path', async () => {
    await expect(estimatePathSize(join(tempDir, 'missing'))).resolves.toBe(0)
  })
})
