import { z } from 'zod'

export const RunnerTypeSchema = z.enum(['local', 'docker', 'k8s', 'secure'])

export type RunnerType = z.infer<typeof RunnerTypeSchema>

export const RunnerStatusSchema = z.enum(['online', 'offline', 'busy'])

export type RunnerStatus = z.infer<typeof RunnerStatusSchema>

export const RunnerCapabilitySchema = z.enum([
  'file.read',
  'file.write',
  'text.search',
  'shell.approval',
  'git.worktree',
  'git.diff',
  'git.apply',
  'git.commit',
])

export type RunnerCapability = z.infer<typeof RunnerCapabilitySchema>

export const RunnerSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  type: RunnerTypeSchema,
  status: RunnerStatusSchema,
  os: z.enum(['windows', 'macos', 'linux']),
  arch: z.enum(['x64', 'arm64']),
  capabilities: z.array(RunnerCapabilitySchema),
  workspaceRoots: z.array(z.string()),
  lastSeenAt: z.string().datetime(),
})

export type Runner = z.infer<typeof RunnerSchema>
