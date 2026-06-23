import {
  normalizeFinalSummary,
  parseAgentStepResponse,
  parseJsonObject,
} from './json'

describe('agent json protocol', () => {
  it('parses plain JSON object', () => {
    expect(parseJsonObject('{"message":"ok","final":true}')).toEqual({
      message: 'ok',
      final: true,
    })
  })

  it('parses fenced JSON object', () => {
    const payload = JSON.stringify(
      {
        message: '查看文件',
        action: {
          name: 'list_files',
          args: { path: '.' },
        },
      },
      null,
      2,
    )
    const fenced = `\`\`\`json
${payload}
\`\`\``

    expect(parseAgentStepResponse(fenced)).toEqual({
      message: '查看文件',
      action: {
        name: 'list_files',
        args: { path: '.' },
      },
    })
  })

  it('rejects invalid JSON', () => {
    expect(() => parseAgentStepResponse('not json')).toThrow('Invalid JSON')
  })

  it('rejects response without final or action', () => {
    expect(() =>
      parseAgentStepResponse(
        JSON.stringify({
          message: 'missing action',
        }),
      ),
    ).toThrow('Agent JSON output does not match protocol')
  })

  it('normalizes final summary', () => {
    expect(normalizeFinalSummary('done')).toEqual({
      changes: ['done'],
      tests: [],
      risks: [],
      nextSteps: [],
    })
  })
})
