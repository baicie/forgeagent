import { BUGFIX_WORKFLOW, getBuiltinWorkflow } from './builtinWorkflows'

describe('builtinWorkflows', () => {
  it('defines bugfix workflow', () => {
    expect(BUGFIX_WORKFLOW.id).toBe('bugfix')
    expect(BUGFIX_WORKFLOW.name).toBe('Bugfix Workflow')
    expect(BUGFIX_WORKFLOW.steps.map(step => step.type)).toEqual([
      'context_pack',
      'llm',
      'agent_loop',
      'validation',
      'readonly_review',
      'approval',
    ])
  })

  it('edit step allows expected tools', () => {
    const editStep = BUGFIX_WORKFLOW.steps.find(s => s.id === 'edit')
    expect(editStep?.tools).toEqual([
      'read_file',
      'search_text',
      'apply_patch',
      'get_diff',
    ])
  })

  it('validate step requires approval', () => {
    const validateStep = BUGFIX_WORKFLOW.steps.find(s => s.id === 'validate')
    expect(validateStep?.approval).toBe('required')
  })

  it('final_approval step has correct actions', () => {
    const approvalStep = BUGFIX_WORKFLOW.steps.find(
      s => s.id === 'final_approval',
    )
    expect(approvalStep?.actions).toEqual(['apply', 'commit', 'discard'])
  })

  it('gets builtin workflow by id', () => {
    expect(getBuiltinWorkflow('bugfix')?.name).toBe('Bugfix Workflow')
    expect(getBuiltinWorkflow('missing')).toBeUndefined()
  })
})
