import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { loadWorkflowDefinition } from './workflowConfig'

describe('loadWorkflowDefinition', () => {
  let tempDir: string

  beforeEach(async () => {
    tempDir = await mkdtemp(path.join(tmpdir(), 'forgeagent-workflow-'))
  })

  afterEach(async () => {
    await rm(tempDir, { recursive: true, force: true })
  })

  it('loads builtin bugfix workflow by default', async () => {
    const workflow = await loadWorkflowDefinition({ repoRoot: tempDir })

    expect(workflow.id).toBe('bugfix')
    expect(workflow.name).toBe('Bugfix Workflow')
  })

  it('loads builtin by explicit id', async () => {
    const workflow = await loadWorkflowDefinition({
      repoRoot: tempDir,
      workflowId: 'bugfix',
    })

    expect(workflow.id).toBe('bugfix')
  })

  it('loads project workflow', async () => {
    await mkdir(path.join(tempDir, '.agents/workflows'), { recursive: true })
    await writeFile(
      path.join(tempDir, '.agents/workflows/custom.yaml'),
      [
        'id: custom',
        'name: Custom Workflow',
        'steps:',
        '  - id: context',
        '    type: context_pack',
        '  - id: final_approval',
        '    type: approval',
        '    actions:',
        '      - apply',
      ].join('\n'),
    )

    const workflow = await loadWorkflowDefinition({
      repoRoot: tempDir,
      workflowId: 'custom',
    })

    expect(workflow.id).toBe('custom')
    expect(workflow.name).toBe('Custom Workflow')
    expect(workflow.steps).toHaveLength(2)
  })

  it('loads project workflow with yml extension', async () => {
    await mkdir(path.join(tempDir, '.agents/workflows'), { recursive: true })
    await writeFile(
      path.join(tempDir, '.agents/workflows/myflow.yml'),
      [
        'id: myflow',
        'name: My Flow',
        'steps:',
        '  - id: context',
        '    type: context_pack',
      ].join('\n'),
    )

    const workflow = await loadWorkflowDefinition({
      repoRoot: tempDir,
      workflowId: 'myflow',
    })

    expect(workflow.id).toBe('myflow')
  })

  it('project workflow takes precedence over builtin', async () => {
    await mkdir(path.join(tempDir, '.agents/workflows'), { recursive: true })
    await writeFile(
      path.join(tempDir, '.agents/workflows/bugfix.yaml'),
      [
        'id: bugfix',
        'name: Custom Bugfix',
        'steps:',
        '  - id: context',
        '    type: context_pack',
      ].join('\n'),
    )

    const workflow = await loadWorkflowDefinition({
      repoRoot: tempDir,
      workflowId: 'bugfix',
    })

    expect(workflow.name).toBe('Custom Bugfix')
  })

  it('throws when workflow does not exist', async () => {
    await expect(
      loadWorkflowDefinition({ repoRoot: tempDir, workflowId: 'missing' }),
    ).rejects.toThrow('Workflow not found')
  })
})
