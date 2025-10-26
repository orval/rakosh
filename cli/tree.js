'use strict'
import { Database } from 'arangojs'
import log from 'loglevel'

import { genTree } from './extract/tree/gentree.js'
import exclude from './lib/option_exclude.js'
import include from './lib/option_include.js'

log.setLevel('WARN')

export default {
  command: 'tree <mine> [--output]',
  describe: 'Extract the data from a mine and publish as a tree of Markdown documents',

  builder: (yargs) => {
    return yargs
      .positional('mine', {
        describe: 'The name of the mine to extract',
        string: true
      })
      .option('output', {
        description: 'The name of the output Markdown file',
        alias: 'o',
        default: 'output.md'
      })
      .option('include', include)
      .option('exclude', exclude)
  },

  handler: async (argv) => {
    try {
      if (argv.verbose) log.setLevel('INFO')

      const conf = { databaseName: argv.mine }
      if (process.env.ARANGO_URL) conf.url = process.env.ARANGO_URL

      const db = new Database(conf)
      if (!await db.exists()) {
        throw new Error(`mine ${argv.mine} does not exist`)
      }

      genTree(db, argv)
    } catch (err) {
      log.error(`ERROR: ${err}`)
      process.exit(1)
    }
  }
}
