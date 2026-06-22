import { z } from 'zod'

export const WorkspaceSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  repoPath: z.string().min(1),
  gitRoot: z.string().min(1),
  currentBranch: z.string().min(1).optional(),
  currentCommit: z.string().min(1).optional(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
})

export type Workspace = z.infer<typeof WorkspaceSchema>

export const CreateWorkspaceInputSchema = z.object({
  repoPath: z.string().min(1),
  name: z.string().min(1).optional(),
})

export type CreateWorkspaceInput = z.infer<typeof CreateWorkspaceInputSchema>

export const WorkspaceSnapshotSchema = z.object({
  workspace: WorkspaceSchema,
  currentBranch: z.string().min(1),
  currentCommit: z.string().min(1),
  isDirty: z.boolean(),
})

export type WorkspaceSnapshot = z.infer<typeof WorkspaceSnapshotSchema>
