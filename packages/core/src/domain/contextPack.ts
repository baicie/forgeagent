import { z } from 'zod'

export const DEFAULT_CONTEXT_PACK_MAX_CHARS = 30_000

export const ContextPackSectionNameSchema = z.enum([
  'Task Goal',
  'Project Rules',
  'Relevant Files',
  'Key Findings',
  'Current Progress',
  'Current Diff',
  'Allowed Tools',
  'Blocked Paths',
  'Validation Commands',
])

export type ContextPackSectionName = z.infer<
  typeof ContextPackSectionNameSchema
>

export const ContextPackSectionSchema = z.object({
  name: ContextPackSectionNameSchema,
  content: z.string(),
  truncated: z.boolean().default(false),
  source: z.string().optional(),
})

export type ContextPackSection = z.infer<typeof ContextPackSectionSchema>

export const ContextPackSchema = z.object({
  taskId: z.string().min(1),
  generatedAt: z.string().datetime(),
  maxChars: z.number().int().positive(),
  sections: z.array(ContextPackSectionSchema),
  content: z.string(),
  bytes: z.number().int().nonnegative(),
  truncated: z.boolean(),
})

export type ContextPack = z.infer<typeof ContextPackSchema>

export interface RenderContextPackInput {
  taskId: string
  generatedAt: string
  maxChars: number
  sections: ContextPackSection[]
}

export function byteLengthUtf8(text: string): number {
  return new TextEncoder().encode(text).length
}

export function truncateText(
  text: string,
  maxChars: number,
): { text: string; truncated: boolean } {
  if (maxChars <= 0) {
    return {
      text: '',
      truncated: text.length > 0,
    }
  }

  if (text.length <= maxChars) {
    return {
      text,
      truncated: false,
    }
  }

  const suffix = '\n...<truncated>'

  if (maxChars <= suffix.length) {
    return {
      text: text.slice(0, maxChars),
      truncated: true,
    }
  }

  return {
    text: `${text.slice(0, maxChars - suffix.length)}${suffix}`,
    truncated: true,
  }
}

export function renderContextPack(input: RenderContextPackInput): ContextPack {
  const header = [
    '# Context Pack',
    '',
    `- Task ID: ${input.taskId}`,
    `- Generated At: ${input.generatedAt}`,
    `- Max Chars: ${input.maxChars}`,
    '',
  ].join('\n')

  const sectionBudget = Math.max(
    500,
    Math.floor(
      (input.maxChars - header.length) / Math.max(input.sections.length, 1),
    ),
  )

  const sections = input.sections.map(section => {
    const truncated = truncateText(section.content.trim(), sectionBudget)

    return {
      ...section,
      content: truncated.text,
      truncated: section.truncated || truncated.truncated,
    }
  })

  const body = sections
    .map(section => {
      const source = section.source ? `\n\n_Source: ${section.source}_` : ''
      const truncated = section.truncated ? '\n\n> Section truncated.' : ''

      return [
        `## ${section.name}`,
        '',
        section.content || '_No content._',
        source,
        truncated,
      ].join('\n')
    })
    .join('\n\n')

  const raw = `${header}${body}\n`
  const final = truncateText(raw, input.maxChars)

  return ContextPackSchema.parse({
    taskId: input.taskId,
    generatedAt: input.generatedAt,
    maxChars: input.maxChars,
    sections,
    content: final.text,
    bytes: byteLengthUtf8(final.text),
    truncated: final.truncated || sections.some(section => section.truncated),
  })
}
