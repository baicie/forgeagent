import { useEffect, useMemo, useState } from 'react'
import { formatBytes } from '@forgeagent/core'
import type { RunnerApiClient } from '../api/client'
import { mergeTaskEvents, subscribeTaskEvents } from '../api/events'
import { ApprovalPanel } from '../components/ApprovalPanel'
import { DiffViewer } from '../components/DiffViewer'
import { ErrorBanner } from '../components/ErrorBanner'
import { TaskTimeline } from '../components/TaskTimeline'
import { ToolCallView } from '../components/ToolCallView'
import type { DiffResult, Task, TaskEvent, Workspace } from '../types'

export interface TaskPageProps {
  client: RunnerApiClient
  taskId: string
  onBack: () => void
}

export function TaskPage(props: TaskPageProps) {
  const [task, setTask] = useState<Task | undefined>()
  const [workspace, setWorkspace] = useState<Workspace | undefined>()
  const [events, setEvents] = useState<TaskEvent[]>([])
  const [diff, setDiff] = useState<DiffResult | undefined>()
  const [error, setError] = useState<unknown>()
  const [notice, setNotice] = useState<string | undefined>()
  const [busy, setBusy] = useState(false)
  const [commitMessage, setCommitMessage] = useState('')

  const lastEventId = useMemo(() => events.at(-1)?.id, [events])

  const runAction = async (action: () => Promise<void>) => {
    setBusy(true)
    setError(undefined)

    try {
      await action()
    } catch (err) {
      setError(err)
    } finally {
      setBusy(false)
    }
  }

  const loadTask = async () => {
    setError(undefined)

    try {
      const nextTask = await props.client.getTask(props.taskId)
      setTask(nextTask)
      setWorkspace(await props.client.getWorkspace(nextTask.workspaceId))
    } catch (err) {
      setError(err)
    }
  }

  const loadDiff = async () => {
    setError(undefined)

    try {
      setDiff(await props.client.getTaskDiff(props.taskId))
    } catch (err) {
      setError(err)
    }
  }

  useEffect(() => {
    setEvents([])
    setDiff(undefined)
    setNotice(undefined)
    void loadTask()
    void loadDiff()

    const unsubscribe = subscribeTaskEvents({
      baseUrl: props.client.baseUrl,
      taskId: props.taskId,
      onEvent(event) {
        setEvents(current => mergeTaskEvents(current, [event]))

        if (event.type === 'task.status') {
          void loadTask()
        }

        if (event.type === 'diff.updated') {
          void loadDiff()
        }

        if (event.type === 'task.completed') {
          setNotice(
            '任务已完成。修改仍在隔离 worktree 中，原仓库尚未变化。请查看 diff 后选择 Apply / Commit / Discard。',
          )
        }
      },
      onError() {
        setError('事件流连接异常，请检查 runner 是否启动')
      },
    })

    return unsubscribe
  }, [props.client, props.taskId])

  const runTask = async () => {
    await runAction(async () => {
      await props.client.runTask(props.taskId)
      await loadTask()
    })
  }

  const approve = async (approvalId: string) => {
    await runAction(async () => {
      await props.client.approveApproval(approvalId)
      await loadTask()
      await loadDiff()
    })
  }

  const reject = async (approvalId: string, reason?: string) => {
    await runAction(async () => {
      await props.client.rejectApproval(approvalId, { reason })
      await loadTask()
    })
  }

  const apply = async () => {
    await runAction(async () => {
      const appliedTask = await props.client.applyTask(props.taskId)
      setTask(appliedTask)
      setWorkspace(await props.client.getWorkspace(appliedTask.workspaceId))
      await loadDiff()
      setNotice('Patch 已应用到原仓库。请回到原仓库执行 git diff 查看变化。')
    })
  }

  const commit = async () => {
    await runAction(async () => {
      await props.client.commitTask(props.taskId, {
        message: commitMessage.trim() || undefined,
      })
      setCommitMessage('')
      await loadTask()
      setNotice(
        'Commit 已创建在 task worktree 分支中，原仓库当前分支未被修改。',
      )
    })
  }

  const discard = async () => {
    await runAction(async () => {
      await props.client.discardTask(props.taskId)
      await loadTask()
      setNotice('Task worktree 和临时分支已丢弃，原仓库未被修改。')
    })
  }

  const cancel = async () => {
    await runAction(async () => {
      await props.client.cancelTask(props.taskId)
      await loadTask()
    })
  }

  const deleteTask = async () => {
    await runAction(async () => {
      const preview = await props.client.getTaskCleanupPreview({
        taskId: props.taskId,
      })

      if (
        !window.confirm(
          `确定要彻底删除这个任务吗？\n\n预计释放空间：${formatBytes(
            preview.estimatedBytes,
          )}\n\n这将删除 worktree 和所有关联记录，无法撤销。`,
        )
      ) {
        return
      }

      await props.client.deleteTask(props.taskId)
      props.onBack()
    })
  }

  return (
    <div className="task-page">
      <div className="task-header">
        <button type="button" onClick={props.onBack}>
          &#8592; 返回
        </button>
        <div>
          <h2>{task?.prompt || props.taskId}</h2>
          <p className="muted">{props.taskId}</p>
        </div>
        <span className={`status-pill status-${task?.status || 'created'}`}>
          {task?.status || 'loading'}
        </span>
      </div>

      {error ? <ErrorBanner error={error} /> : null}
      {notice ? <div className="notice">{notice}</div> : null}

      <section className="panel">
        <h3>交付边界</h3>
        <dl className="meta-list">
          <dt>Original Repo</dt>
          <dd>{workspace?.gitRoot || 'loading...'}</dd>
          <dt>Task Worktree</dt>
          <dd>{task?.worktreePath || 'loading...'}</dd>
          <dt>Base</dt>
          <dd>
            {task ? `${task.baseBranch}@${task.baseCommit}` : 'loading...'}
          </dd>
        </dl>
        <p className="muted">
          Agent 只修改 Task Worktree。原仓库只有在点击 Apply 后才会被写入。
        </p>
      </section>

      <div className="task-actions">
        <button disabled={busy} type="button" onClick={runTask}>
          启动 / 继续 Agent
        </button>
        <button disabled={busy} type="button" onClick={loadDiff}>
          刷新 diff
        </button>
        <button
          disabled={busy}
          type="button"
          onClick={apply}
          title="把 worktree 中的 patch 应用到原仓库"
        >
          Apply 到原仓库
        </button>
        <input
          value={commitMessage}
          placeholder="commit message，可选"
          onChange={event => setCommitMessage(event.currentTarget.value)}
        />
        <button
          disabled={busy}
          type="button"
          onClick={commit}
          title="在 task worktree 分支中提交，不修改原仓库当前分支"
        >
          Commit Worktree
        </button>
        <button
          disabled={busy}
          type="button"
          onClick={discard}
          title="删除 task worktree 和临时分支，不修改原仓库"
        >
          Discard
        </button>
        <button disabled={busy} type="button" onClick={cancel}>
          Cancel
        </button>
        <button
          disabled={busy}
          type="button"
          onClick={deleteTask}
          className="btn-danger"
        >
          删除任务
        </button>
      </div>

      <div className="task-layout">
        <section className="panel">
          <h3>审批</h3>
          <ApprovalPanel
            events={events}
            onApprove={approve}
            onReject={reject}
          />
        </section>

        <section className="panel">
          <h3>事件流</h3>
          <TaskTimeline events={events} />
        </section>

        <section className="panel">
          <h3>工具调用</h3>
          <ToolCallView events={events} />
        </section>

        <section className="panel wide">
          <h3>Diff</h3>
          <DiffViewer
            diff={diff?.diff || ''}
            lastEventId={lastEventId}
            worktreePath={task?.worktreePath}
          />
        </section>
      </div>
    </div>
  )
}
