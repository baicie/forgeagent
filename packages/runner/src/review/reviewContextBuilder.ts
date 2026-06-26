import type { Task, TaskMemoryFileName } from '@forgeagent/core'
import type { GitDiffService } from '../git/diff'
import type { TaskMemoryService } from '../services/taskMemoryService'

export interface ReviewContextBuilderOptions {
  maxChars?: number
}

interface BuildReviewContextInput {
  task: Task
}

const AGENT_RULE_FILES = [
  'AGENTS.md',
  '.agents/AGENTS.md',
  '.agents/golden-principles.md',
]

function truncate(text: string, maxChars: number): string {
  if (text.length <= maxChars) return text

  return `${text.slice(0, maxChars)}\n...<truncated>`
}

export class ReviewContextBuilder {
  constructor(
    private readonly taskMemoryService: TaskMemoryService,
    private readonly gitDiffService: GitDiffService,
    private readonly options: ReviewContextBuilderOptions = {},
  ) {}

  async build(input: BuildReviewContextInput): Promise<string> {
    const sections = [
      await this.buildRulesSection(input.task.worktreePath),
      await this.buildMemorySection(input.task.id, 'task_plan.md', 'Task Plan'),
      await this.buildMemorySection(
        input.task.id,
        'changed_files.md',
        'Changed Files',
      ),
      await this.buildMemorySection(
        input.task.id,
        'test_results.md',
        'Test Results',
      ),
      await this.buildMemorySection(
        input.task.id,
        'final_summary.md',
        'Final Summary',
      ),
      await this.buildDiffSection(input.task),
    ]

    return truncate(
      sections.filter(Boolean).join('\n\n---\n\n'),
      this.options.maxChars ?? 30_000,
    )
  }

  private async buildRulesSection(repoRoot: string): Promise<string> {
    const parts: string[] = ['## Project Rules']

    for (const file of AGENT_RULE_FILES) {
      try {
        const content = await this.readFileSafe(repoRoot, file)
        if (content) {
          parts.push(`\n### ${file}\n\n${content}`)
        }
      } catch {
        // File not found; skip.
      }
    }

    return parts.join('\n')
  }

  private async buildMemorySection(
    taskId: string,
    file: TaskMemoryFileName,
    heading: string,
  ): Promise<string> {
    try {
      const content = await this.taskMemoryService.readTaskMemoryFile(
        taskId,
        file,
      )
      return `## ${heading}\n\n${content.content}`
    } catch {
      return ''
    }
  }

  private async buildDiffSection(task: Task): Promise<string> {
    try {
      const diff = await this.gitDiffService.getDiff(task.worktreePath)
      return `## Git Diff\n\n${diff}`
    } catch {
      return ''
    }
  }

  private async readFileSafe(root: string, file: string): Promise<string> {
    const path = `${root}/${file}`
    const { readFile } = await import('node:fs/promises')
    return await readFile(path, 'utf-8')
  }
}
