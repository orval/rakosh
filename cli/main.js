#!/usr/bin/env node
'use strict'
import yargs from 'yargs/yargs'
import { hideBin } from 'yargs/helpers'

import fs from './fs.js'
import gentest from './gentest.js'
import uuid from './uuid.js'

const importCommand = async (moduleName) => {
  const module = await import(`./${moduleName}.js`)
  return module.default
}

yargs(hideBin(process.argv))
  .command(await importCommand('deposit'))
  .command(await importCommand('gatsby'))
  .command(await importCommand('html'))
  .command(await importCommand('pdf'))
  .command(await importCommand('confluence'))
  .command(fs)
  .command(gentest)
  .command(uuid)
  .demandCommand(1)
  .option('verbose', {
    alias: 'v',
    type: 'boolean',
    description: 'Run with verbose output'
  })
  .epilogue('Go to https://github.com/orval/rakosh for more information')
  .strict()
  .parse()
