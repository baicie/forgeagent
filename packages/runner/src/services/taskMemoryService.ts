import type {
  Task,
  TaskMemoryFile,
  TaskMemoryFileName,
  TaskMemorySnapshot,
} from '@forgeagent/core'
import { TASK_MEMORY_FILES, TaskMemoryFileNameSchema } from '@forgeagent/core'
import {
  appendFile,
  mkdir,
  readFile,
  rm,
  stat,
  writeFile,
} from 'node:fs/promises'
import { resolve } from 'node:path'
import type { RunnerConfig } from '../config'
import type { EventService } from './eventService'

export interface AppendTaskMemoryInput {
  taskId: string
  file: TaskMemoryFileName
  heading?: string
  content: string
  reason?: string
}

export interface RecordAgentStepInput {
  taskId: string
  step: number
  maxSteps: number
  message: string
  actionName?: string
}

export interface RecordToolResultInput {
  taskId: string
  toolName: string
  args: unknown
  result: unknown
}

export interface RecordCommandResultInput {
  taskId: string
  command: string
  cwd: string
  ok: boolean
  exitCode?: number | null
  timedOut?: boolean
  stdout?: string
  stderr?: string
  error?: string
  rejected?: boolean
  reason?: string
}

function now(): string {
  return new Date().toISOString()
}

function formatSection(heading: string | undefined, content: string): string {
  const body = content.trimEnd()

  if (!heading) {
    return `\n${body}\n`
  }

  return `\n## ${heading}\n\n${body}\n`
}

function safeJson(value: unknown, maxChars = 4000): string {
  let text: string

  try {
    text = JSON.stringify(value, null, 2)
  } catch {
    text = String(value)
  }

  if (text.length <= maxChars) {
    return text
  }

  return `${text.slice(0, maxChars)}\n...<truncated>`
}

function takeLines(text: string | undefined, maxLines = 40): string {
  if (!text) return ''

  const lines = text.split(/\r?\n/)

  if (lines.length <= maxLines) {
    return text
  }

  return `${lines.slice(0, maxLines).join('\n')}\n...<truncated>`
}

function createInitialTaskPlan(task: Task): string {
  return `# Task Plan

## Goal

${task.prompt}

## Context

- Task ID: \`${task.id}\`
- Base: \`${task.baseBranch}@${task.baseCommit}\`
- Worktree: \`${task.worktreePath}\`

## Constraints

- Agent must modify only the isolated task worktree.
- Original repository must not change until apply.
- Prefer minimal, focused changes.
- Do not touch ignored, generated, or sensitive files.
- Run validation commands when needed and with approval.

## Steps

- [ ] Understand the task.
- [ ] Inspect relevant files.
- [ ] Record key findings.
- [ ] Make focused changes.
- [ ] Check diff.
- [ ] Run validation if needed.
- [ ] Summarize changes, tests, risks, and next steps.
`
}

function createInitialProgress(task: Task): string {
  return `# Progress

## Created

- Time: ${now()}
- Status: ${task.status}
- Task: ${task.prompt}
- Worktree: ${task.worktreePath}

## Current

Task created. Agent has not finished yet.

## Next

Start or continue the agent loop.
`
}

function createInitialFindings(): string {
  return `# Findings

No findings recorded yet.
`
}

function createInitialDecisions(): string {
  return `# Decisions

No decisions recorded yet.
`
}

function createInitialChangedFiles(): string {
  return `# Changed Files

No changed files recorded yet.
`
}

function createInitialTestResults(): string {
  return `# Test Results

No validation command has been recorded yet.
`
}

function createInitialFinalSummary(): string {
  return `# Final Summary

Task has not produced a final summary yet.
`
}

function createInitialContent(task: Task, file: TaskMemoryFileName): string {
  switch (file) {
    case 'task_plan.md':
      return createInitialTaskPlan(task)
    case 'progress.md':
      return createInitialProgress(task)
    case 'findings.md':
      return createInitialFindings()
    case 'decisions.md':
      return createInitialDecisions()
    case 'changed_files.md':
      return createInitialChangedFiles()
    case 'test_results.md':
      return createInitialTestResults()
    case 'final_summary.md':
      return createInitialFinalSummary()
    default: {
      const _exhaustive: never = file
      return _exhaustive
    }
  }
}

function asRecord(value: unknown): Record<string, unknown> {
  return typeof value === 'object' && value !== null
    ? (value as Record<string, unknown>)
    : {}
}

function readString(
  record: Record<string, unknown>,
  key: string,
): string | undefined {
  const value = record[key]

  return typeof value === 'string' ? value : undefined
}

function readStringArray(
  record: Record<string, unknown>,
  key: string,
): string[] {
  const value = record[key]

  return Array.isArray(value)
    ? value.filter((item): item is string => typeof item === 'string')
    : []
}

export class TaskMemoryService {
  constructor(
    private readonly config: RunnerConfig,
    private readonly eventService: EventService,
  ) {}

  getRunDir(taskId: string): string {
    return resolve(this.config.dataDir, 'runs', taskId)
  }

  getMemoryFilePath(taskId: string, file: TaskMemoryFileName): string {
    return resolve(this.getRunDir(taskId), TaskMemoryFileNameSchema.parse(file))
  }

  async initializeTaskMemory(task: Task): Promise<void> {
    await mkdir(this.getRunDir(task.id), { recursive: true })

    for (const file of TASK_MEMORY_FILES) {
      await writeFile(
        this.getMemoryFilePath(task.id, file),
        createInitialContent(task, file),
        'utf-8',
      )
    }

    await this.emitUpdated(task.id, 'task_plan.md', 'Task memory initialized')
    await this.emitUpdated(task.id, 'progress.md', 'Task memory initialized')
  }

  async readTaskMemory(taskId: string): Promise<TaskMemorySnapshot> {
    const files: TaskMemoryFile[] = []

    for (const file of TASK_MEMORY_FILES) {
      files.push(await this.readTaskMemoryFile(taskId, file))
    }

    return {
      taskId,
      runDir: this.getRunDir(taskId),
      files,
    }
  }

  async readTaskMemoryFile(
    taskId: string,
    file: TaskMemoryFileName,
  ): Promise<TaskMemoryFile> {
    const parsedFile = TaskMemoryFileNameSchema.parse(file)
    const path = this.getMemoryFilePath(taskId, parsedFile)
    const [content, fileStat] = await Promise.all([
      readFile(path, 'utf-8'),
      stat(path),
    ])

    return {
      file: parsedFile,
      content,
      bytes: Buffer.byteLength(content, 'utf-8'),
      updatedAt: fileStat.mtime.toISOString(),
    }
  }

  async append(input: AppendTaskMemoryInput): Promise<void> {
    const file = TaskMemoryFileNameSchema.parse(input.file)
    const path = this.getMemoryFilePath(input.taskId, file)

    await mkdir(this.getRunDir(input.taskId), { recursive: true })
    await appendFile(path, formatSection(input.heading, input.content), 'utf-8')
    await this.emitUpdated(input.taskId, file, input.reason)
  }

  async write(input: AppendTaskMemoryInput): Promise<void> {
    const file = TaskMemoryFileNameSchema.parse(input.file)
    const path = this.getMemoryFilePath(input.taskId, file)

    await mkdir(this.getRunDir(input.taskId), { recursive: true })
    await writeFile(path, input.content, 'utf-8')
    await this.emitUpdated(input.taskId, file, input.reason)
  }

  async recordStatusChange(input: {
    task: Task
    previousStatus?: string
    status: string
    reason?: string
  }): Promise<void> {
    await this.append({
      taskId: input.task.id,
      file: 'progress.md',
      heading: `Status: ${input.status}`,
      reason: 'Task status changed',
      content: [
        `- Time: ${now()}`,
        input.previousStatus
          ? `- Previous: ${input.previousStatus}`
          : undefined,
        `- Current: ${input.status}`,
        input.reason ? `- Reason: ${input.reason}` : undefined,
      ]
        .filter(Boolean)
        .join('\n'),
    })
  }

  async recordAgentStep(input: RecordAgentStepInput): Promise<void> {
    await this.append({
      taskId: input.taskId,
      file: 'progress.md',
      heading: `Agent step ${input.step}/${input.maxSteps}`,
      reason: 'Agent step recorded',
      content: [
        `- Time: ${now()}`,
        `- Message: ${input.message}`,
        input.actionName ? `- Action: ${input.actionName}` : undefined,
      ]
        .filter(Boolean)
        .join('\n'),
    })
  }

  async recordToolResult(input: RecordToolResultInput): Promise<void> {
    if (input.toolName === 'search_text') {
      await this.recordSearchTextResult(input)
      return
    }

    if (input.toolName === 'read_file') {
      await this.recordReadFileResult(input)
      return
    }

    if (input.toolName === 'apply_patch') {
      await this.recordApplyPatchResult(input)
      return
    }

    if (input.toolName === 'get_diff') {
      await this.append({
        taskId: input.taskId,
        file: 'progress.md',
        heading: 'Diff checked',
        reason: 'Diff checked',
        content: `- Time: ${now()}\n- Result: ${safeJson(input.result, 2000)}`,
      })
      return
    }

    if (input.toolName === 'run_command') {
      await this.append({
        taskId: input.taskId,
        file: 'progress.md',
        heading: 'Command approval requested',
        reason: 'Command approval requested',
        content: `- Time: ${now()}\n- Request: ${safeJson(input.result, 2000)}`,
      })
    }
  }

  async recordCommandResult(input: RecordCommandResultInput): Promise<void> {
    await this.append({
      taskId: input.taskId,
      file: 'test_results.md',
      heading: input.rejected
        ? `Command rejected: ${input.command}`
        : `Command finished: ${input.command}`,
      reason: 'Command result recorded',
      content: [
        `- Time: ${now()}`,
        `- CWD: ${input.cwd}`,
        `- OK: ${input.ok}`,
        input.exitCode !== undefined && input.exitCode !== null
          ? `- Exit code: ${input.exitCode}`
          : undefined,
        input.timedOut !== undefined
          ? `- Timed out: ${input.timedOut}`
          : undefined,
        input.reason ? `- Reason: ${input.reason}` : undefined,
        input.error ? `- Error: ${input.error}` : undefined,
        input.stdout
          ? `\n### stdout\n\n\`\`\`txt\n${takeLines(input.stdout)}\n\`\`\``
          : undefined,
        input.stderr
          ? `\n### stderr\n\n\`\`\`txt\n${takeLines(input.stderr)}\n\`\`\``
          : undefined,
      ]
        .filter(Boolean)
        .join('\n'),
    })
  }

  async recordFinalSummary(input: {
    taskId: string
    message: string
    summary?: unknown
  }): Promise<void> {
    await this.write({
      taskId: input.taskId,
      file: 'final_summary.md',
      reason: 'Final summary recorded',
      content: [
        '# Final Summary',
        '',
        '## Message',
        '',
        input.message,
        '',
        '## Summary',
        '',
        '```json',
        safeJson(input.summary ?? {}, 10_000),
        '```',
        '',
      ].join('\n'),
    })
  }

  async recordFailure(input: {
    taskId: string
    error: unknown
  }): Promise<void> {
    await this.append({
      taskId: input.taskId,
      file: 'progress.md',
      heading: 'Task failed',
      reason: 'Task failed',
      content: `- Time: ${now()}\n- Error: ${safeJson(input.error, 4000)}`,
    })

    await this.write({
      taskId: input.taskId,
      file: 'final_summary.md',
      reason: 'Failure summary recorded',
      content: [
        '# Final Summary',
        '',
        'Task failed before a successful final summary.',
        '',
        '## Error',
        '',
        '```json',
        safeJson(input.error, 10_000),
        '```',
        '',
      ].join('\n'),
    })
  }

  async deleteTaskMemory(taskId: string): Promise<void> {
    await rm(this.getRunDir(taskId), {
      recursive: true,
      force: true,
    })
  }

  private async recordSearchTextResult(
    input: RecordToolResultInput,
  ): Promise<void> {
    const args = asRecord(input.args)
    const result = asRecord(input.result)
    const matches = Array.isArray(result.matches) ? result.matches : []
    const query = readString(args, 'query') || '<unknown>'

    const lines = [
      `- Time: ${now()}`,
      `- Query: \`${query}\``,
      `- Match count: ${matches.length}`,
      '',
      ...matches.slice(0, 10).map((match, index) => {
        const record = asRecord(match)

        return [
          `${index + 1}. \`${readString(record, 'path') || '<unknown>'}:${String(record.line ?? '?')}\``,
          `   ${readString(record, 'text') || ''}`,
        ].join('\n')
      }),
    ]

    await this.append({
      taskId: input.taskId,
      file: 'findings.md',
      heading: `Search: ${query}`,
      reason: 'Search findings recorded',
      content: lines.join('\n'),
    })
  }

  private async recordReadFileResult(
    input: RecordToolResultInput,
  ): Promise<void> {
    const args = asRecord(input.args)
    const path = readString(args, 'path') || '<unknown>'

    await this.append({
      taskId: input.taskId,
      file: 'findings.md',
      heading: `Read file: ${path}`,
      reason: 'Read file recorded',
      content: [
        `- Time: ${now()}`,
        `- File: \`${path}\``,
        '- Purpose: file was read as task context.',
      ].join('\n'),
    })
  }

  private async recordApplyPatchResult(
    input: RecordToolResultInput,
  ): Promise<void> {
    const result = asRecord(input.result)
    const changedFiles = readStringArray(result, 'changedFiles')

    await this.append({
      taskId: input.taskId,
      file: 'changed_files.md',
      heading: 'Patch applied',
      reason: 'Changed files recorded',
      content: [
        `- Time: ${now()}`,
        changedFiles.length > 0
          ? changedFiles.map(file => `- \`${file}\``).join('\n')
          : '- No changed files returned.',
      ].join('\n'),
    })

    await this.append({
      taskId: input.taskId,
      file: 'decisions.md',
      heading: 'Code change decision',
      reason: 'Decision recorded',
      content: [
        `- Time: ${now()}`,
        '- Decision: Agent applied a patch to the isolated worktree.',
        changedFiles.length > 0
          ? `- Files: ${changedFiles.map(file => `\`${file}\``).join(', ')}`
          : undefined,
      ]
        .filter(Boolean)
        .join('\n'),
    })
  }

  private async emitUpdated(
    taskId: string,
    file: TaskMemoryFileName,
    reason?: string,
  ): Promise<void> {
    let bytes = 0

    try {
      const content = await readFile(
        this.getMemoryFilePath(taskId, file),
        'utf-8',
      )
      bytes = Buffer.byteLength(content, 'utf-8')
    } catch {
      bytes = 0
    }

    await this.eventService.append({
      taskId,
      type: 'memory.updated',
      payload: {
        file,
        bytes,
        reason,
      },
    })
  }
}
