import { readFile, writeFile } from 'node:fs/promises'
import { Command } from 'commander'
import pc from 'picocolors'

const CONFIG_FILE = './forgeagent.config.json'

const showCommand = new Command('show')
  .description('Show current configuration')
  .action(async () => {
    try {
      const content = await readFile(CONFIG_FILE, 'utf-8')
      console.log(pc.green('Current config:'))
      console.log(JSON.stringify(JSON.parse(content), null, 2))
    } catch {
      console.log(pc.dim('No config file found. Using defaults.'))
    }
  })

const initCommand = new Command('init')
  .description('Initialize configuration file')
  .action(async () => {
    const defaultConfig = {
      model: 'openai/gpt-4.1',
      workspace: process.cwd(),
      skillsDir: './skills',
      maxSteps: 20,
    }

    await writeFile(
      CONFIG_FILE,
      JSON.stringify(defaultConfig, null, 2),
      'utf-8',
    )

    console.log(pc.green(`Config file created: ${CONFIG_FILE}`))
  })

export const configCommand = new Command('config')
  .description('Manage ForgeAgent configuration')
  .addCommand(showCommand)
  .addCommand(initCommand)
