import path from 'node:path'

const SENSITIVE_EXTENSIONS = new Set(['.pem', '.key', '.crt'])
const SENSITIVE_BASENAMES = new Set(['id_rsa', 'id_ed25519'])
const SENSITIVE_SEGMENTS = new Set(['.ssh', '.aws', '.kube', '.git'])

function toSegments(targetPath: string): string[] {
  return targetPath.replaceAll('\\', '/').split('/').filter(Boolean)
}

export function isSensitivePath(targetPath: string): boolean {
  const segments = toSegments(targetPath)
  const lowerSegments = segments.map(segment => segment.toLowerCase())

  if (lowerSegments.some(segment => SENSITIVE_SEGMENTS.has(segment))) {
    return true
  }

  const basename = path.posix.basename(targetPath.replaceAll('\\', '/'))
  const lowerBasename = basename.toLowerCase()

  if (lowerBasename === '.env' || lowerBasename.startsWith('.env.')) {
    return true
  }

  if (SENSITIVE_BASENAMES.has(lowerBasename)) {
    return true
  }

  return SENSITIVE_EXTENSIONS.has(path.extname(lowerBasename))
}
