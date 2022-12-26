#!/usr/bin/env node
'use strict'
const yargs = require('yargs/yargs')
const { hideBin } = require('yargs/helpers')

yargs(hideBin(process.argv))
  .command(require('./deposit'))
  .command(require('./extract'))
  .command(require('./uuid'))
  .demandCommand(1)
  .option('verbose', {
    alias: 'v',
    type: 'boolean',
    description: 'Run with verbose output'
  })
  .epilogue('Go to https://github.com/orval/rakosh for more information')
  .strict()
  .parse()
