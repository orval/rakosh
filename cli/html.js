'use strict'
import { statSync, existsSync, mkdirSync } from 'node:fs'

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
      .positional('directory', {
        describe: 'Target directory into which to extract the HTML and media',
        default: 'output',
        string: true,
        normalize: true,
        coerce: d => {
          if (!existsSync(d)) {
            mkdirSync(d)
          }
          checkDir(d)
          return d
        }
      })
      .option('include', include)
      .option('exclude', exclude)
      .check((argv) => {
        return checkDir(argv.directory)
      })
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

function checkDir (d) {
  try {
    if (!statSync(d).isDirectory()) throw new Error()
  } catch {
    throw new Error(`${d} is not a directory`)
  }
  return 1
}
