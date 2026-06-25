import type {
  ContextPack,
  ContextPackSection,
  Task,
  TaskMemoryFileName,
  Workspace,
} from '@forgeagent/core'
import {
  DEFAULT_CONTEXT_PACK_MAX_CHARS,
  renderContextPack,
  truncateText,
} from '@forgeagent/core'
import { readdir, readFile, stat } from 'node:fs/promises'
import path from 'node:path'
import type { RunnerConfig } from '../config'
import type { GitDiffService } from '../git/diff'
import type { TaskMemoryService } from '../services/taskMemoryService'

export interface ContextPackBuilderOptions {
  maxChars?: number
  maxProjectRuleChars?: number
  maxMemoryChars?: number
  maxRelevantFiles?: number
  maxRelevantFileChars?: number
  maxDiffChars?: number
}

export interface BuildContextPackInput {
  task: Task
  workspace: Workspace
}

const DEFAULT_ALLOWED_TOOLS = [
  'list_files',
  'read_file',
  'search_text',
  'apply_patch',
  'run_command',
  'get_diff',
]

const DEFAULT_BLOCKED_PATHS = [
  '.git/**',
  'node_modules/**',
  'dist/**',
  'build/**',
  'coverage/**',
  '.env',
  '.env.*',
  '**/*.pem',
  '**/*.key',
  '**/id_rsa',
  '**/id_ed25519',
]

const DEFAULT_VALIDATION_COMMANDS = [
  'pnpm typecheck',
  'pnpm test:run',
  'pnpm build',
]

const IGNORED_DIRS = new Set([
  '.git',
  '.agents',
  'node_modules',
  'dist',
  'build',
  'coverage',
  '.next',
  '.turbo',
  '.vite',
  'temp',
])

function now(): string {
  return new Date().toISOString()
}

function normalizePath(input: string): string {
  return input.split(path.sep).join('/')
}

function isSensitivePath(relativePath: string): boolean {
  const normalized = normalizePath(relativePath)
  const base = path.posix.basename(normalized)

  return (
    base === '.env' ||
    base.startsWith('.env.') ||
    /\.pem$/i.test(base) ||
    /\.key$/i.test(base) ||
    base === 'id_rsa' ||
    base === 'id_ed25519'
  )
}

function isIgnoredPath(relativePath: string): boolean {
  const parts = normalizePath(relativePath).split('/')

  return parts.some(part => IGNORED_DIRS.has(part))
}

function uniq(items: string[]): string[] {
  return [...new Set(items)]
}

function collectTaskKeywords(prompt: string): string[] {
  return uniq(
    prompt
      .split(/[^\w\-\u4E00-\u9FA5]+/)
      .map(item => item.trim())
      .filter(item => item.length >= 3)
      .slice(0, 20),
  )
}

function scorePath(relativePath: string, keywords: string[]): number {
  const normalized = relativePath.toLowerCase()
  let score = 0

  for (const keyword of keywords) {
    if (normalized.includes(keyword.toLowerCase())) {
      score += 5
    }
  }

  if (/\.(?:ts|tsx|js|jsx|mjs|cjs|java|py|rs|go)$/.test(normalized)) {
    score += 2
  }

  if (
    /readme|agent|runner|task|error|diff|git|context|memory/.test(normalized)
  ) {
    score += 2
  }

  if (/test|spec/.test(normalized)) {
    score += 1
  }

  return score
}

async function readOptionalFile(filePath: string): Promise<string | undefined> {
  try {
    const fileStat = await stat(filePath)

    if (!fileStat.isFile() || fileStat.size > 128 * 1024) {
      return undefined
    }

    return readFile(filePath, 'utf-8')
  } catch {
    return undefined
  }
}

async function collectMarkdownFiles(dir: string): Promise<string[]> {
  try {
    const entries = await readdir(dir, { withFileTypes: true })

    const files: string[] = []

    for (const entry of entries) {
      const absolutePath = path.join(dir, entry.name)

      if (entry.isDirectory()) {
        files.push(...(await collectMarkdownFiles(absolutePath)))
        continue
      }

      if (
        entry.isFile() &&
        /\.(?:md|mdx|txt|yaml|yml|json)$/i.test(entry.name)
      ) {
        files.push(absolutePath)
      }
    }

    return files
  } catch {
    return []
  }
}

async function collectCandidateFiles(root: string): Promise<string[]> {
  const results: string[] = []

  async function visit(current: string): Promise<void> {
    let entries

    try {
      entries = await readdir(current, { withFileTypes: true })
    } catch {
      return
    }

    entries.sort((a, b) => a.name.localeCompare(b.name))

    for (const entry of entries) {
      const absolutePath = path.join(current, entry.name)
      const relativePath = path.relative(root, absolutePath)

      if (isIgnoredPath(relativePath) || isSensitivePath(relativePath)) {
        continue
      }

      if (entry.isDirectory()) {
        await visit(absolutePath)
        continue
      }

      if (!entry.isFile()) {
        continue
      }

      if (
        !/\.(?:ts|tsx|js|jsx|mjs|cjs|json|md|yaml|yml|java|py|rs|go|css|html)$/.test(
          entry.name,
        )
      ) {
        continue
      }

      results.push(relativePath)
    }
  }

  await visit(root)

  return results
}

export class ContextPackBuilder {
  constructor(
    private readonly config: RunnerConfig,
    private readonly taskMemoryService: TaskMemoryService,
    private readonly gitDiffService: GitDiffService,
    private readonly options: ContextPackBuilderOptions = {},
  ) {}

  async build(input: BuildContextPackInput): Promise<ContextPack> {
    await this.taskMemoryService.ensureTaskMemory(input.task)

    const maxChars =
      this.options.maxChars ??
      this.config.contextPackMaxChars ??
      DEFAULT_CONTEXT_PACK_MAX_CHARS

    const sections: ContextPackSection[] = []

    sections.push(await this.buildTaskGoalSection(input.task, input.workspace))
    sections.push(await this.buildProjectRulesSection(input.task.worktreePath))
    sections.push(await this.buildRelevantFilesSection(input.task))
    sections.push(
      await this.buildMemorySection(
        input.task.id,
        'findings.md',
        'Key Findings',
      ),
    )
    sections.push(
      await this.buildMemorySection(
        input.task.id,
        'progress.md',
        'Current Progress',
      ),
    )
    sections.push(await this.buildCurrentDiffSection(input.task))
    sections.push({
      name: 'Allowed Tools',
      content: DEFAULT_ALLOWED_TOOLS.map(tool => `- ${tool}`).join('\n'),
      truncated: false,
    })
    sections.push({
      name: 'Blocked Paths',
      content: DEFAULT_BLOCKED_PATHS.map(pattern => `- ${pattern}`).join('\n'),
      truncated: false,
    })
    sections.push(
      await this.buildValidationCommandsSection(input.task.worktreePath),
    )

    const pack = renderContextPack({
      taskId: input.task.id,
      generatedAt: now(),
      maxChars,
      sections,
    })

    await this.taskMemoryService.write({
      taskId: input.task.id,
      file: 'context_pack.md',
      content: pack.content,
      reason: 'Context pack generated',
    })

    return pack
  }

  private async buildTaskGoalSection(
    task: Task,
    workspace: Workspace,
  ): Promise<ContextPackSection> {
    let taskPlan = ''

    try {
      const file = await this.taskMemoryService.readTaskMemoryFile(
        task.id,
        'task_plan.md',
      )
      taskPlan = truncateText(
        file.content,
        this.options.maxMemoryChars ?? 5_000,
      ).text
    } catch {
      taskPlan = 'No task_plan.md found.'
    }

    return {
      name: 'Task Goal',
      content: [
        task.prompt,
        '',
        '### Execution Boundary',
        '',
        `- Workspace: ${workspace.gitRoot}`,
        `- Worktree: ${task.worktreePath}`,
        `- Base: ${task.baseBranch}@${task.baseCommit}`,
        '- Agent must modify only the task worktree.',
        '- Original repository remains unchanged until apply.',
        '',
        '### Task Plan Snapshot',
        '',
        taskPlan,
      ].join('\n'),
      truncated: false,
      source: 'task prompt + task_plan.md',
    }
  }

  private async buildProjectRulesSection(
    repoRoot: string,
  ): Promise<ContextPackSection> {
    const chunks: string[] = []
    const maxChars = this.options.maxProjectRuleChars ?? 8_000

    const rootAgents = await readOptionalFile(path.join(repoRoot, 'AGENTS.md'))

    if (rootAgents) {
      chunks.push(`### AGENTS.md\n\n${rootAgents}`)
    }

    const agentsDir = path.join(repoRoot, '.agents')
    const agentsMd = await readOptionalFile(path.join(agentsDir, 'AGENTS.md'))

    if (agentsMd) {
      chunks.push(`### .agents/AGENTS.md\n\n${agentsMd}`)
    }

    const rulesFiles = await collectMarkdownFiles(path.join(agentsDir, 'rules'))
    const skillsFiles = await collectMarkdownFiles(
      path.join(agentsDir, 'skills'),
    )

    for (const file of [...rulesFiles, ...skillsFiles].sort()) {
      if (isSensitivePath(path.relative(repoRoot, file))) {
        continue
      }

      const content = await readOptionalFile(file)

      if (!content) continue

      chunks.push(
        `### ${normalizePath(path.relative(repoRoot, file))}\n\n${content}`,
      )
    }

    const raw =
      chunks.length > 0
        ? chunks.join('\n\n---\n\n')
        : 'No AGENTS.md or .agents rules/skills found.'

    const truncated = truncateText(raw, maxChars)

    return {
      name: 'Project Rules',
      content: truncated.text,
      truncated: truncated.truncated,
      source: 'AGENTS.md + .agents/AGENTS.md + .agents/rules + .agents/skills',
    }
  }

  private async buildRelevantFilesSection(
    task: Task,
  ): Promise<ContextPackSection> {
    const keywords = collectTaskKeywords(task.prompt)
    const candidates = await collectCandidateFiles(task.worktreePath)
    const maxFiles = this.options.maxRelevantFiles ?? 12
    const maxFileChars = this.options.maxRelevantFileChars ?? 1200

    const ranked = candidates
      .map(relativePath => ({
        relativePath,
        score: scorePath(relativePath, keywords),
      }))
      .filter(item => item.score > 0)
      .sort(
        (a, b) =>
          b.score - a.score || a.relativePath.localeCompare(b.relativePath),
      )
      .slice(0, maxFiles)

    if (ranked.length === 0) {
      return {
        name: 'Relevant Files',
        content:
          'No high-confidence relevant files selected yet. Agent should use search_text/list_files before editing.',
        truncated: false,
      }
    }

    const chunks: string[] = []

    for (const item of ranked) {
      const absolutePath = path.join(task.worktreePath, item.relativePath)
      const content = await readOptionalFile(absolutePath)

      if (!content) continue

      const truncated = truncateText(content, maxFileChars)

      chunks.push(
        [
          `### ${normalizePath(item.relativePath)}`,
          '',
          `Score: ${item.score}`,
          '',
          '```txt',
          truncated.text,
          '```',
          truncated.truncated ? '> File summary truncated.' : '',
        ].join('\n'),
      )
    }

    return {
      name: 'Relevant Files',
      content: chunks.join('\n\n'),
      truncated: ranked.length >= maxFiles,
      source: 'worktree candidate files scored by task prompt',
    }
  }

  private async buildMemorySection(
    taskId: string,
    file: TaskMemoryFileName,
    name: 'Key Findings' | 'Current Progress',
  ): Promise<ContextPackSection> {
    const maxChars = this.options.maxMemoryChars ?? 5_000

    try {
      const memoryFile = await this.taskMemoryService.readTaskMemoryFile(
        taskId,
        file,
      )
      const truncated = truncateText(memoryFile.content, maxChars)

      return {
        name,
        content: truncated.text,
        truncated: truncated.truncated,
        source: file,
      }
    } catch {
      return {
        name,
        content: `No ${file} found.`,
        truncated: false,
        source: file,
      }
    }
  }

  private async buildCurrentDiffSection(
    task: Task,
  ): Promise<ContextPackSection> {
    const maxChars = this.options.maxDiffChars ?? 5_000

    try {
      const diff = await this.gitDiffService.getDiff(task.worktreePath)
      const content = diff.trim() ? diff : 'No current diff in task worktree.'
      const truncated = truncateText(content, maxChars)

      return {
        name: 'Current Diff',
        content: truncated.text,
        truncated: truncated.truncated,
        source: 'git diff from task worktree',
      }
    } catch (error) {
      return {
        name: 'Current Diff',
        content: `Failed to read current diff: ${
          error instanceof Error ? error.message : String(error)
        }`,
        truncated: false,
        source: 'git diff from task worktree',
      }
    }
  }

  private async buildValidationCommandsSection(
    repoRoot: string,
  ): Promise<ContextPackSection> {
    const commands = [...DEFAULT_VALIDATION_COMMANDS]

    const packageJsonContent = await readOptionalFile(
      path.join(repoRoot, 'package.json'),
    )

    if (packageJsonContent) {
      try {
        const packageJson = JSON.parse(packageJsonContent) as {
          scripts?: Record<string, string>
        }

        const scripts = Object.keys(packageJson.scripts ?? {})
          .filter(name =>
            /^(?:test|test:run|typecheck|lint|build|format:check)$/.test(name),
          )
          .map(name => `pnpm ${name}`)

        commands.push(...scripts)
      } catch {
        // Ignore invalid package.json. Context pack should still be generated.
      }
    }

    return {
      name: 'Validation Commands',
      content: uniq(commands)
        .map(command => `- ${command}`)
        .join('\n'),
      truncated: false,
      source: 'defaults + package.json scripts',
    }
  }
}
