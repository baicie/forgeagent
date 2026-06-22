import type { CommandRiskLevel } from '../domain/tool'

export interface CommandRisk {
  level: CommandRiskLevel
  reasons: string[]
}

const DANGEROUS_PATTERNS: Array<[RegExp, string]> = [
  [/\brm\s+-[rf][a-zA-Z]*\b/, 'rm -rf'],
  [/\brm\s+-[fr][a-zA-Z]*\b/, 'rm -fr'],
  [/\bsudo\b/, 'sudo'],
  [/\bchmod\s+-R\s+777\b/, 'chmod -R 777'],
  [/\bcurl\b[\s\S]*\|\s*(sh|bash)\b/, 'curl | sh'],
  [/\bwget\b[\s\S]*\|\s*(sh|bash)\b/, 'wget | sh'],
  [/\b(npm|pnpm|yarn)\s+publish\b/, 'package publish'],
  [/\bdocker\s+system\s+prune\b/, 'docker system prune'],
  [/\bkubectl\b/, 'kubectl'],
  [/\bssh\b/, 'ssh'],
  [/\bscp\b/, 'scp'],
  [/\bmysql\b/, 'mysql'],
  [/\bpsql\b/, 'psql'],
  [/\bredis-cli\b/, 'redis-cli'],
]

const HIGH_PATTERNS: Array<[RegExp, string]> = [
  [/\bgit\s+push\b/, 'git push'],
  [/\bgit\s+reset\s+--hard\b/, 'git reset --hard'],
  [/\bgit\s+clean\b/, 'git clean'],
  [/\brm\b/, 'rm'],
  [/\bchmod\b/, 'chmod'],
  [/\bdocker\b/, 'docker'],
]

const MEDIUM_PATTERNS: Array<[RegExp, string]> = [
  [/\b(npm|pnpm|yarn)\s+install\b/, 'dependency install'],
  [/\b(npm|pnpm|yarn)\s+add\b/, 'dependency add'],
  [/\bcurl\b/, 'curl'],
  [/\bwget\b/, 'wget'],
  [/\bpython\b/, 'python'],
  [/\bnode\b/, 'node'],
]

function matchReasons(
  command: string,
  patterns: Array<[RegExp, string]>,
): string[] {
  return patterns
    .filter(([pattern]) => pattern.test(command))
    .map(([, reason]) => reason)
}

export function classifyCommandRisk(command: string): CommandRisk {
  const normalizedCommand = command.trim()

  const dangerousReasons = matchReasons(normalizedCommand, DANGEROUS_PATTERNS)

  if (dangerousReasons.length > 0) {
    return {
      level: 'dangerous',
      reasons: dangerousReasons,
    }
  }

  const highReasons = matchReasons(normalizedCommand, HIGH_PATTERNS)

  if (highReasons.length > 0) {
    return {
      level: 'high',
      reasons: highReasons,
    }
  }

  const mediumReasons = matchReasons(normalizedCommand, MEDIUM_PATTERNS)

  if (mediumReasons.length > 0) {
    return {
      level: 'medium',
      reasons: mediumReasons,
    }
  }

  return {
    level: 'low',
    reasons: [],
  }
}
