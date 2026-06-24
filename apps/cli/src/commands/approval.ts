import { Command } from 'commander'
import pc from 'picocolors'
import { createRunnerApiClient } from '../client/runnerClient'

export function createApprovalCommand(): Command {
  const command = new Command('approval').description('Manage approvals')

  command
    .command('approve')
    .description('Approve a pending command')
    .argument('<id>', 'Approval ID')
    .action(async (id: string) => {
      const client = createRunnerApiClient()
      const result = await client.approveApproval(id)
      console.log(pc.green('Approved'))
      if (result !== undefined) console.log(JSON.stringify(result, null, 2))
    })

  command
    .command('reject')
    .description('Reject a pending command')
    .argument('<id>', 'Approval ID')
    .action(async (id: string) => {
      const client = createRunnerApiClient()
      const result = await client.rejectApproval(id)
      console.log(pc.red('Rejected'))
      if (result !== undefined) console.log(JSON.stringify(result, null, 2))
    })

  return command
}
