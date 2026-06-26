import { describe, it, expect } from 'vitest'
import {
  createReviewerSystemPrompt,
  createReviewerTaskPrompt,
  createReviewerToolResultPrompt,
  renderReviewMarkdown,
} from './reviewerPrompts'
import type { ReviewResult } from '@forgeagent/core'

describe('reviewer prompts', () => {
  it('system prompt contains read-only restrictions', () => {
    const prompt = createReviewerSystemPrompt()
    expect(prompt).toContain('只读 reviewer')
    expect(prompt).toContain('禁止修改文件')
    expect(prompt).toContain('禁止 apply_patch')
    expect(prompt).toContain('禁止 run_command')
    expect(prompt).toContain('read_file')
    expect(prompt).toContain('search_text')
    expect(prompt).toContain('get_diff')
  })

  it('system prompt requires strict JSON output', () => {
    const prompt = createReviewerSystemPrompt()
    expect(prompt).toContain('严格 JSON')
    expect(prompt).toContain('"final": true')
    expect(prompt).toContain('"review":')
  })

  it('tool result prompt truncates long output', () => {
    const longResult = { data: 'x'.repeat(20_000) }
    const prompt = createReviewerToolResultPrompt({
      toolName: 'read_file',
      result: longResult,
      maxChars: 500,
    })

    expect(prompt).toContain('...<truncated>')
    expect(prompt.length).toBeLessThan(600)
  })

  it('tool result prompt formats result', () => {
    const prompt = createReviewerToolResultPrompt({
      toolName: 'read_file',
      result: { lines: ['hello', 'world'] },
      maxChars: 10_000,
    })

    expect(prompt).toContain('read_file')
    expect(prompt).toContain('hello')
    expect(prompt).toContain('world')
  })

  it('renderReviewMarkdown formats passed review', () => {
    const review: ReviewResult = {
      taskId: 'task_1',
      status: 'passed',
      recommendation: 'apply',
      goalCompleted: true,
      hasUnrelatedChanges: false,
      violatesProjectRules: false,
      missingTests: false,
      hasSecurityRisk: false,
      hasCompatibilityRisk: false,
      summary: 'Looks good.',
      findings: [],
      reviewedAt: '2026-06-25T10:00:00.000Z',
    }

    const md = renderReviewMarkdown(review)

    expect(md).toContain('# Review Report')
    expect(md).toContain('Status: passed')
    expect(md).toContain('Recommendation: apply')
    expect(md).toContain('Goal Completed: true')
    expect(md).toContain('Looks good.')
    expect(md).toContain('No findings.')
  })

  it('renderReviewMarkdown formats review with findings', () => {
    const review: ReviewResult = {
      taskId: 'task_1',
      status: 'warning',
      recommendation: 'needs_fix',
      goalCompleted: true,
      hasUnrelatedChanges: false,
      violatesProjectRules: false,
      missingTests: true,
      hasSecurityRisk: false,
      hasCompatibilityRisk: false,
      summary: 'Missing tests.',
      findings: [
        {
          severity: 'warning',
          category: 'test',
          message: 'No test results found.',
          file: 'src/main.ts',
          line: 42,
          suggestion: 'Run pnpm test.',
        },
      ],
      reviewedAt: '2026-06-25T10:00:00.000Z',
    }

    const md = renderReviewMarkdown(review)

    expect(md).toContain('Status: warning')
    expect(md).toContain('[warning] test')
    expect(md).toContain('No test results found.')
    expect(md).toContain('src/main.ts:42')
    expect(md).toContain('Suggestion: Run pnpm test.')
  })

  it('createReviewerTaskPrompt includes task info', () => {
    const prompt = createReviewerTaskPrompt({
      taskId: 'task_abc',
      taskPrompt: 'Fix the bug in parser',
      reviewContext: '## Changes\n- Fixed parser',
    })

    expect(prompt).toContain('task_abc')
    expect(prompt).toContain('Fix the bug in parser')
    expect(prompt).toContain('## Changes')
  })
})
