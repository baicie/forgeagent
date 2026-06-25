import { lstat, readdir } from 'node:fs/promises'
import { join } from 'node:path'

export async function estimatePathSize(path: string): Promise<number> {
  let stat

  try {
    stat = await lstat(path)
  } catch {
    return 0
  }

  if (stat.isSymbolicLink()) {
    return 0
  }

  if (stat.isFile()) {
    return stat.size
  }

  if (!stat.isDirectory()) {
    return 0
  }

  let total = 0
  let entries

  try {
    entries = await readdir(path, { withFileTypes: true })
  } catch {
    return 0
  }

  for (const entry of entries) {
    total += await estimatePathSize(join(path, entry.name))
  }

  return total
}
