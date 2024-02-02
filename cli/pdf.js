'use strict'
import { Database } from 'arangojs'
import log from 'loglevel'

import { generatePdf } from './extract/pdf/genpdf.js'
import exclude from './lib/option_exclude.js'
import include from './lib/option_include.js'

log.setLevel('WARN')

export default {
  command: 'pdf <mine> [--output]',
  describe: 'Extract the data from a mine and publish as pages in a PDF',

  builder: (yargs) => {
    return yargs
      .positional('mine', {
        describe: 'The name of the mine to extract',
        string: true
      })
      .option('output', {
        description: 'The name of the output PDF file',
        alias: 'o',
        default: 'output.pdf'
      })
      .option('toch1', {
        type: 'boolean',
        default: true,
        description: 'Include <H1> headings in TOC',
        alias: 'h'
      })
      .option('tocdepth', {
        type: 'number',
        default: 3,
        description: 'Depth of headings in TOC',
        alias: 'd',
        coerce: m => {
          if (Number.isInteger(m) && m >= 0) return m
          throw new Error(`tocdepth value [${m}] is not valid`)
        }
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

      generatePdf(db, argv)
    } catch (err) {
      log.error(`ERROR: ${err}`)
      process.exit(1)
    }
  }
}
