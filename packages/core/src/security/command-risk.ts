import type { CommandRiskLevel } from '../domain/tool'

export interface CommandRisk {
  level: CommandRiskLevel
  reasons: string[]
}

const DANGEROUS_PATTERNS: Array<[RegExp, string]> = [
  [/\bsudo\b/i, 'sudo'],
  [/\bchmod\s+-R\s+777\b/i, 'chmod -R 777'],
  [/\bcurl\b[\s\S]*\|\s*(sh|bash)\b/i, 'curl | sh'],
  [/\bwget\b[\s\S]*\|\s*(sh|bash)\b/i, 'wget | sh'],
  [/\b(npm|pnpm|yarn)\s+publish\b/i, 'package publish'],
  [/\bdocker\s+system\s+prune\b/i, 'docker system prune'],
  [/\bkubectl\b/i, 'kubectl'],
  [/\bssh\b/i, 'ssh'],
  [/\bscp\b/i, 'scp'],
  [/\bmysql\b/i, 'mysql'],
  [/\bpsql\b/i, 'psql'],
  [/\bredis-cli\b/i, 'redis-cli'],
]

const HIGH_PATTERNS: Array<[RegExp, string]> = [
  [/\bgit\s+push\b/i, 'git push'],
  [/\bgit\s+reset\s+--hard\b/i, 'git reset --hard'],
  [/\bgit\s+clean\b/i, 'git clean'],
  [/\brm\b/i, 'rm'],
  [/\bchmod\b/i, 'chmod'],
  [/\bdocker\b/i, 'docker'],
]

const MEDIUM_PATTERNS: Array<[RegExp, string]> = [
  [/\b(npm|pnpm|yarn)\s+install\b/i, 'dependency install'],
  [/\b(npm|pnpm|yarn)\s+add\b/i, 'dependency add'],
  [/\bcurl\b/i, 'curl'],
  [/\bwget\b/i, 'wget'],
  [/\bpython\b/i, 'python'],
  [/\bnode\b/i, 'node'],
]

function tokenizeCommand(command: string): string[] {
  return command.trim().split(/\s+/).filter(Boolean)
}

function hasRecursiveForceRm(command: string): boolean {
  const tokens = tokenizeCommand(command)

  for (let index = 0; index < tokens.length; index += 1) {
    if (tokens[index].toLowerCase() !== 'rm') {
      continue
    }

    const optionTokens: string[] = []

    for (
      let optionIndex = index + 1;
      optionIndex < tokens.length;
      optionIndex += 1
    ) {
      const token = tokens[optionIndex]

      if (!token.startsWith('-') || token === '--') {
        break
      }

      optionTokens.push(token)
    }

    const flags = optionTokens.join('').replaceAll('-', '').toLowerCase()

    if (flags.includes('r') && flags.includes('f')) {
      return true
    }
  }

  return false
}

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

  if (hasRecursiveForceRm(normalizedCommand)) {
    dangerousReasons.unshift('rm -rf')
  }

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
