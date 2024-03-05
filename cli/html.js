'use strict'
import { Database } from 'arangojs'
import log from 'loglevel'

import { genHtml } from './extract/html/genhtml.js'
import exclude from './lib/option_exclude.js'
import include from './lib/option_include.js'

log.setLevel('WARN')

export default {
  command: 'html <mine> [<directory>]',
  describe: 'Extract the data from a mine and publish as an HTML document',

  builder: (yargs) => {
    return yargs
      .positional('mine', {
        describe: 'The name of the mine to extract',
        string: true
      })
      .option('output', {
        description: 'The name of the output HTML file',
        alias: 'o',
        default: 'output.html'
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

      genHtml(db, argv)
    } catch (err) {
      log.error(`ERROR: ${err}`)
      process.exit(1)
    }
  }
}
