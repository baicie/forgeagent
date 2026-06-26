import type { ReviewResult } from '@forgeagent/core'

export interface ReviewerPromptInput {
  taskId: string
  taskPrompt: string
  reviewContext: string
}

export function createReviewerSystemPrompt(): string {
  return `你是 ForgeAgent Read-only Reviewer Subagent。

你的职责：
1. 审查已完成任务是否满足用户原始目标。
2. 审查 diff 是否包含无关修改。
3. 审查是否违反 AGENTS.md / .agents 规则。
4. 审查是否缺少测试或验证结果。
5. 审查是否存在安全、兼容性、维护性风险。
6. 给出是否建议 apply / commit。

硬性限制：
1. 你是只读 reviewer。
2. 禁止修改文件。
3. 禁止 apply_patch。
4. 禁止 run_command。
5. 禁止 commit / discard / apply。
6. 只允许 read_file / search_text / get_diff。
7. 如果上下文已足够，直接 final。
8. 输出必须是严格 JSON，不要 Markdown，不要解释性前后缀。

允许工具：
read_file:
  args: { "path": "README.md" }

search_text:
  args: { "query": "foo", "path": ".", "caseSensitive": false, "maxResults": 50 }

get_diff:
  args: {}

final 示例：
{
  "message": "审查完成。",
  "final": true,
  "review": {
    "status": "warning",
    "recommendation": "needs_fix",
    "goalCompleted": true,
    "hasUnrelatedChanges": false,
    "violatesProjectRules": false,
    "missingTests": true,
    "hasSecurityRisk": false,
    "hasCompatibilityRisk": false,
    "summary": "目标基本完成，但缺少验证测试。",
    "findings": [
      {
        "severity": "warning",
        "category": "test",
        "message": "未看到 pnpm test:run 或等价测试结果。",
        "suggestion": "补充验证后再 apply。"
      }
    ]
  }
}`
}

export function createReviewerTaskPrompt(input: ReviewerPromptInput): string {
  return `请审查以下 ForgeAgent task。

Task ID: ${input.taskId}

用户原始任务：
${input.taskPrompt}

审查上下文：
${input.reviewContext}

请基于上下文进行只读审查。`
}

export function createReviewerToolResultPrompt(input: {
  toolName: string
  result: unknown
  maxChars: number
}): string {
  const raw = JSON.stringify(input.result, null, 2) ?? String(input.result)
  const content =
    raw.length > input.maxChars
      ? `${raw.slice(0, input.maxChars)}\n...<truncated>`
      : raw

  return `只读工具 ${input.toolName} 执行结果：

${content}

请继续审查。`
}

export function renderReviewMarkdown(result: ReviewResult): string {
  return [
    '# Review Report',
    '',
    `- Status: ${result.status}`,
    `- Recommendation: ${result.recommendation}`,
    `- Goal Completed: ${result.goalCompleted}`,
    `- Has Unrelated Changes: ${result.hasUnrelatedChanges}`,
    `- Violates Project Rules: ${result.violatesProjectRules}`,
    `- Missing Tests: ${result.missingTests}`,
    `- Security Risk: ${result.hasSecurityRisk}`,
    `- Compatibility Risk: ${result.hasCompatibilityRisk}`,
    `- Reviewed At: ${result.reviewedAt}`,
    '',
    '## Summary',
    '',
    result.summary,
    '',
    '## Findings',
    '',
    result.findings.length > 0
      ? result.findings
          .map(
            (finding: {
              severity: string
              category: string
              message: string
              file?: string
              line?: number
              suggestion?: string
            }) =>
              `- [${finding.severity}] ${finding.category}: ${finding.message}${
                finding.file
                  ? ` (${finding.file}${finding.line ? `:${finding.line}` : ''})`
                  : ''
              }${finding.suggestion ? `\n  - Suggestion: ${finding.suggestion}` : ''}`,
          )
          .join('\n')
      : 'No findings.',
    '',
    '## JSON',
    '',
    '```json',
    JSON.stringify(result, null, 2),
    '```',
    '',
  ].join('\n')
}
