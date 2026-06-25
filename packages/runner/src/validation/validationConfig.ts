import type { ValidationConfig } from '@forgeagent/core'
import {
  ValidationConfigSchema,
  normalizeValidationCommands,
} from '@forgeagent/core'
import { readFile } from 'node:fs/promises'
import path from 'node:path'
import { parse as parseYaml } from 'yaml'

export interface LoadValidationConfigInput {
  repoRoot: string
  taskValidation?: {
    commands?: Array<
      string | { command: string; cwd?: string; reason?: string }
    >
    maxFixAttempts?: number
  }
}

async function readOptionalText(filePath: string): Promise<string | undefined> {
  try {
    return await readFile(filePath, 'utf-8')
  } catch {
    return undefined
  }
}

async function readAgentsValidationConfig(
  repoRoot: string,
): Promise<Partial<ValidationConfig>> {
  const yamlPath = path.join(repoRoot, '.agents', 'validation.yaml')
  const ymlPath = path.join(repoRoot, '.agents', 'validation.yml')
  const content =
    (await readOptionalText(yamlPath)) ?? (await readOptionalText(ymlPath))

  if (!content) {
    return {}
  }

  const parsed = parseYaml(content) as unknown

  if (typeof parsed === 'object' && parsed !== null && 'validation' in parsed) {
    return (
      (parsed as { validation?: Partial<ValidationConfig> }).validation ?? {}
    )
  }

  return parsed as Partial<ValidationConfig>
}

async function inferPackageJsonCommands(repoRoot: string): Promise<string[]> {
  const content = await readOptionalText(path.join(repoRoot, 'package.json'))

  if (!content) {
    return []
  }

  try {
    const packageJson = JSON.parse(content) as {
      scripts?: Record<string, string>
    }

    const scripts = packageJson.scripts ?? {}
    const candidates = ['typecheck', 'test:run', 'test', 'build']

    return candidates
      .filter(name => typeof scripts[name] === 'string')
      .map(name => `pnpm ${name}`)
  } catch {
    return []
  }
}

function mergeValidationConfig(
  inferredCommands: string[],
  projectConfig: Partial<ValidationConfig>,
  taskConfig?: Partial<ValidationConfig>,
): ValidationConfig {
  const projectCommands = projectConfig.commands ?? []
  const taskCommands = taskConfig?.commands

  const commands =
    taskCommands && taskCommands.length > 0
      ? taskCommands
      : projectCommands.length > 0
        ? projectCommands
        : inferredCommands

  const maxFixAttempts =
    taskConfig?.maxFixAttempts ??
    projectConfig.maxFixAttempts ??
    ValidationConfigSchema.parse({}).maxFixAttempts

  return ValidationConfigSchema.parse({
    commands,
    maxFixAttempts,
  })
}

export async function loadValidationConfig(
  input: LoadValidationConfigInput,
): Promise<ValidationConfig> {
  const [projectConfig, inferredCommands] = await Promise.all([
    readAgentsValidationConfig(input.repoRoot),
    inferPackageJsonCommands(input.repoRoot),
  ])

  const merged = mergeValidationConfig(
    inferredCommands,
    projectConfig,
    input.taskValidation as Partial<ValidationConfig>,
  )

  return {
    ...merged,
    commands: normalizeValidationCommands(merged.commands),
  }
}
