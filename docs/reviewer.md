# Read-only Reviewer

Phase 16 introduces the first Subagent: Read-only Reviewer.

## Trigger

Review runs after task is `completed`, before apply/commit/discard:

```bash
forgeagent task review <taskId>
forgeagent task review <taskId> --show
forgeagent task memory <taskId> --file review_report.md
```

Console can also click "运行只读审查" on the task page.

## Input

Reviewer reads:

- User original task prompt
- task_plan.md
- changed_files.md
- test_results.md
- final_summary.md
- git diff
- AGENTS.md
- .agents/AGENTS.md
- .agents/golden-principles.md
- .agents/rules/\*

## Permissions

Reviewer is read-only.

Allowed:

- read_file
- search_text
- get_diff

Forbidden:

- apply_patch
- run_command
- commit
- discard
- apply
- delete
- mcp.\*
- plugin.\*

Enforcement:

1. `ReviewerService` only whitelists read tools.
2. ToolRegistry descriptor must have `source=core`, `type=read`, `permission=allowed`.
3. Before/after git diff comparison ensures no mutation.

## Output

Review produces structured result:

- `status`: passed / warning / failed
- `recommendation`: apply / commit / needs_fix / reject
- `goalCompleted`: whether the task goal was met
- `hasUnrelatedChanges`: whether diff contains unrelated changes
- `violatesProjectRules`: whether project rules were violated
- `missingTests`: whether tests are missing
- `hasSecurityRisk`: whether there are security concerns
- `hasCompatibilityRisk`: whether there are compatibility issues
- `findings`: array of detailed findings with severity, category, message, file, line, suggestion

Result is written to:

```txt
~/.forgeagent/runs/<taskId>/review_report.md
```

## Delivery

Apply / Commit buttons show a `ReviewRiskBanner`:

- No review yet: "建议先审查"
- Review passed: "审查通过：apply"
- Review warning/failed: "审查风险：warning，建议修复"

First version only displays risk, does not block delivery.
