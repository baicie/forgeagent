import { useEffect, useState } from 'react'
import type { RunnerApiClient } from '../api/client'
import type { Task, Workspace } from '../types'
import { WorkspacePicker } from '../components/WorkspacePicker'

export interface HomePageProps {
  client: RunnerApiClient
  onOpenTask: (taskId: string) => void
}

export function HomePage(props: HomePageProps) {
  const [workspaces, setWorkspaces] = useState<Workspace[]>([])
  const [tasks, setTasks] = useState<Task[]>([])
  const [repoPath, setRepoPath] = useState('')
  const [workspaceName, setWorkspaceName] = useState('')
  const [workspaceId, setWorkspaceId] = useState('')
  const [prompt, setPrompt] = useState('')
  const [error, setError] = useState<string | undefined>()
  const [loading, setLoading] = useState(false)

  const load = async (preferredWorkspaceId?: string) => {
    setLoading(true)
    setError(undefined)

    try {
      const [nextWorkspaces, nextTasks] = await Promise.all([
        props.client.listWorkspaces(),
        props.client.listTasks(),
      ])

      setWorkspaces(nextWorkspaces)
      setTasks(nextTasks)

      const preferred = preferredWorkspaceId || workspaceId
      const preferredExists = nextWorkspaces.some(
        workspace => workspace.id === preferred,
      )

      if (preferred && preferredExists) {
        setWorkspaceId(preferred)
      } else if (nextWorkspaces[0]) {
        setWorkspaceId(nextWorkspaces[0].id)
      } else {
        setWorkspaceId('')
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void load()
  }, [])

  const addWorkspace = async () => {
    if (!repoPath.trim()) {
      setError('请填写本地 Git 仓库路径')
      return
    }

    setLoading(true)
    setError(undefined)

    try {
      const workspace = await props.client.createWorkspace({
        repoPath: repoPath.trim(),
        name: workspaceName.trim() || undefined,
      })

      setRepoPath('')
      setWorkspaceName('')
      await load(workspace.id)
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    } finally {
      setLoading(false)
    }
  }

  const createTask = async () => {
    if (!workspaceId) {
      setError('请先选择 workspace')
      return
    }

    if (!prompt.trim()) {
      setError('请填写任务描述')
      return
    }

    setLoading(true)
    setError(undefined)

    try {
      const task = await props.client.createTask({
        workspaceId,
        prompt: prompt.trim(),
      })

      setPrompt('')
      props.onOpenTask(task.id)
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="page-grid">
      <section className="panel">
        <h2>添加本地仓库</h2>
        <label>
          仓库路径
          <input
            value={repoPath}
            placeholder="/Users/me/project"
            onChange={event => setRepoPath(event.currentTarget.value)}
          />
        </label>
        <label>
          名称，可选
          <input
            value={workspaceName}
            placeholder="my-project"
            onChange={event => setWorkspaceName(event.currentTarget.value)}
          />
        </label>
        <button disabled={loading} type="button" onClick={addWorkspace}>
          添加 workspace
        </button>
      </section>

      <section className="panel">
        <h2>创建任务</h2>
        <WorkspacePicker
          workspaces={workspaces}
          value={workspaceId}
          onChange={setWorkspaceId}
        />
        <label>
          任务描述
          <textarea
            value={prompt}
            rows={5}
            placeholder="修复 xxx bug，并运行测试"
            onChange={event => setPrompt(event.currentTarget.value)}
          />
        </label>
        <button
          disabled={loading || !workspaceId}
          type="button"
          onClick={createTask}
        >
          创建任务
        </button>
      </section>

      <section className="panel wide">
        <div className="panel-header">
          <h2>任务列表</h2>
          <button type="button" onClick={() => void load()}>
            刷新
          </button>
        </div>

        {error ? <div className="error">{error}</div> : null}

        <div className="task-list">
          {tasks.map(task => (
            <button
              className="task-row"
              key={task.id}
              type="button"
              onClick={() => props.onOpenTask(task.id)}
            >
              <span className={`status-pill status-${task.status}`}>
                {task.status}
              </span>
              <span className="task-title">{task.prompt}</span>
              <span className="muted">{task.id}</span>
            </button>
          ))}

          {tasks.length === 0 ? <p className="muted">暂无任务</p> : null}
        </div>
      </section>
    </div>
  )
}
