# Validation Feedback Loop

Phase 15 introduces automatic validation feedback for agent tasks.

## Configuration

Project-level configuration lives at:

```txt
.agents/validation.yaml
```

Example:

```yaml
validation:
  commands:
    - pnpm typecheck
    - pnpm test:run
    - pnpm build
  maxFixAttempts: 3
```

### Priority

Validation commands are loaded in order:

1. Task-level: passed when creating the task (CLI `--validate` or API `validation.commands`)
2. Project-level: `.agents/validation.yaml`
3. Inferred from `package.json` scripts: `typecheck`, `test:run`, `test`, `build`
4. Runner default: no validation commands

## Behavior

1. Agent modifies files and calls `get_diff`.
2. When `final=true`, if there are validation commands, Runner intercepts and requests user approval for the first validation command.
3. User approves the validation command.
4. ApprovalGate executes it and records the result.
5. If failed, the next `run task` feeds the failure summary back to the Agent.
6. Agent continues fixing within `maxFixAttempts`.
7. On success or exhaustion of attempts, Agent may `final`.

## Security

ForgeAgent never bypasses command approval. All validation commands go through the same approval flow as user-requested commands.

## CLI Usage

```bash
forgeagent task create \
  --workspace <id> \
  --prompt "fix bug" \
  --validate "pnpm typecheck" "pnpm test:run" \
  --max-fix-attempts 3 \
  --run
```

## API

```bash
GET /api/tasks/:id/validation
```

Returns:

```json
{
  "plan": { "taskId": "...", "commands": [...], "status": "...", "results": [...] },
  "summary": { "status": "passed|failed", "passed": 1, "failed": 0, "fixAttempt": 0 }
}
```
