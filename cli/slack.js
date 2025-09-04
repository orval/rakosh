'use strict'
import { Database } from 'arangojs'
import log from 'loglevel'

import { genSlack } from './extract/slack/genslack.js'
import exclude from './lib/option_exclude.js'
import include from './lib/option_include.js'

log.setLevel('WARN')

export default {
  command: 'slack <mine> [--output]',
  describe: 'Extract the data from a mine and convert it to JSONL for use by a Slack app',

  builder: (yargs) => {
    return yargs
      .positional('mine', {
        describe: 'The name of the mine to extract',
        string: true
      })
      .option('output', {
        description: 'The name of the output JSONL file',
        alias: 'o',
        default: 'output.jsonl'
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

      genSlack(db, argv)
    } catch (err) {
      log.error(`ERROR: ${err}`)
      process.exit(1)
    }
  }
}
