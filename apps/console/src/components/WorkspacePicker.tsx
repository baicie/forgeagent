import type { Workspace } from '../types'

export interface WorkspacePickerProps {
  workspaces: Workspace[]
  value: string
  onChange: (value: string) => void
}

export function WorkspacePicker(props: WorkspacePickerProps) {
  return (
    <label>
      Workspace
      <select
        value={props.value}
        onChange={event => props.onChange(event.currentTarget.value)}
      >
        <option value="">请选择 workspace</option>
        {props.workspaces.map(workspace => (
          <option key={workspace.id} value={workspace.id}>
            {workspace.name}
            {' · '}
            {workspace.gitRoot}
          </option>
        ))}
      </select>
    </label>
  )
}
