#!/usr/bin/env node
import { config as loadEnv } from 'dotenv'
import { createCliProgram } from './cli'
import { formatCliError } from './errors'

loadEnv()

createCliProgram()
  .parseAsync()
  .catch(error => {
    console.error(formatCliError(error))
    process.exitCode = 1
  })
