const IGNORED_SEGMENTS = new Set([
  'node_modules',
  'dist',
  'build',
  'coverage',
  '.next',
  '.nuxt',
  '.turbo',
  '.cache',
  '.git',
])

function toSegments(targetPath: string): string[] {
  return targetPath.replaceAll('\\', '/').split('/').filter(Boolean)
}

export function isIgnoredPath(targetPath: string): boolean {
  return toSegments(targetPath).some(segment =>
    IGNORED_SEGMENTS.has(segment.toLowerCase()),
  )
}
