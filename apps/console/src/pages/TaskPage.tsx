import { useEffect, useMemo, useState } from 'react'
import type { RunnerApiClient } from '../api/client'
import { mergeTaskEvents, subscribeTaskEvents } from '../api/events'
import { ApprovalPanel } from '../components/ApprovalPanel'
import { DiffViewer } from '../components/DiffViewer'
import { TaskTimeline } from '../components/TaskTimeline'
import { ToolCallView } from '../components/ToolCallView'
import type { DiffResult, Task, TaskEvent } from '../types'

export interface TaskPageProps {
  client: RunnerApiClient
  taskId: string
  onBack: () => void
}

export function TaskPage(props: TaskPageProps) {
  const [task, setTask] = useState<Task | undefined>()
  const [events, setEvents] = useState<TaskEvent[]>([])
  const [diff, setDiff] = useState<DiffResult | undefined>()
  const [error, setError] = useState<string | undefined>()
  const [busy, setBusy] = useState(false)
  const [commitMessage, setCommitMessage] = useState('')

  const lastEventId = useMemo(() => events.at(-1)?.id, [events])

  const runAction = async (action: () => Promise<void>) => {
    setBusy(true)
    setError(undefined)

    try {
      await action()
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    } finally {
      setBusy(false)
    }
  }

  const loadTask = async () => {
    setError(undefined)

    try {
      const nextTask = await props.client.getTask(props.taskId)
      setTask(nextTask)
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    }
  }

  const loadDiff = async () => {
    setError(undefined)

    try {
      setDiff(await props.client.getTaskDiff(props.taskId))
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    }
  }

  useEffect(() => {
    setEvents([])
    setDiff(undefined)
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
      await props.client.applyTask(props.taskId)
      await loadTask()
      await loadDiff()
    })
  }

  const commit = async () => {
    await runAction(async () => {
      await props.client.commitTask(props.taskId, {
        message: commitMessage.trim() || undefined,
      })
      setCommitMessage('')
      await loadTask()
    })
  }

  const discard = async () => {
    await runAction(async () => {
      await props.client.discardTask(props.taskId)
      await loadTask()
    })
  }

  const cancel = async () => {
    await runAction(async () => {
      await props.client.cancelTask(props.taskId)
      await loadTask()
    })
  }

  const deleteTask = async () => {
    if (!window.confirm('确定要彻底删除这个任务吗？\n\n这将删除 worktree 和所有关联记录，无法撤销。')) {
      return
    }

    await runAction(async () => {
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

      {error ? <div className="error">{error}</div> : null}

      <div className="task-actions">
        <button disabled={busy} type="button" onClick={runTask}>
          启动 / 继续 Agent
        </button>
        <button disabled={busy} type="button" onClick={loadDiff}>
          刷新 diff
        </button>
        <button disabled={busy} type="button" onClick={apply}>
          Apply
        </button>
        <input
          value={commitMessage}
          placeholder="commit message，可选"
          onChange={event => setCommitMessage(event.currentTarget.value)}
        />
        <button disabled={busy} type="button" onClick={commit}>
          Commit
        </button>
        <button disabled={busy} type="button" onClick={discard}>
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
          <DiffViewer diff={diff?.diff || ''} lastEventId={lastEventId} />
        </section>
      </div>
    </div>
  )
}
