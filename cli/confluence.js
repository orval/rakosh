'use strict'
import { Database } from 'arangojs'
import log from 'loglevel'

import { confluencePages } from './extract/confluence/pages.js'
import exclude from './lib/option_exclude.js'
import include from './lib/option_include.js'

log.setLevel('WARN')

export default {
  command: 'confluence <mine> <domain> <spacekey> <startpageid> [--ccauth]',
  describe: 'Extract the data from a mine and publish as pages to Confluence Cloud',

  builder: (yargs) => {
    return yargs
      .positional('mine', {
        describe: 'The name of the mine to extract',
        string: true
      })
      .positional('domain', {
        description: 'The atlassian.net subdomain to connect to',
        string: true,
        coerce: (arg) => {
        // only allow lowercase letters, numbers, and hyphens
        // per https://community.atlassian.com/t5/Confluence-questions/change-subdomain/qaq-p/1874867
          if (!arg.match(/^[a-z0-9-]+$/)) {
            throw new Error(`Invalid domain [${arg}]`)
          }
          return arg
        }
      })
      .positional('spacekey', {
        description: 'Confluence space key',
        string: true
      })
      .positional('startpageid', {
        description: 'numeric ID of the page where mine will be extracted to',
        coerce: (arg) => {
          const num = Number(arg)
          if (isNaN(num) || !Number.isInteger(num)) {
            throw new Error(`Invalid page ID [${arg}]`)
          }
          return num
        }
      })
      .option('include', include)
      .option('exclude', exclude)
      .env('RAKOSH')
      .option('ccauth', {
        description: 'Confluence Cloud credentials in format <your_email@domain.com>:<your_user_api_token>'
      })
      .check((argv) => {
        if (!argv.ccauth || argv.ccauth === 'RAKOSH_CCAUTH') {
          log.error('rakosh requires Confluence Cloud credentials in format <your_email@domain.com>:<your_user_api_token>')
          log.error('Either set RAKOSH_CCAUTH in the environment or use --ccauth\n')
          throw new Error('ccauth required')
        }
        return true
      })
      .option('delete-all-under-start-page-id', {
        boolean: true,
        hidden: true
      })
      .option('lookup', {
        type: 'boolean',
        default: false,
        description: 'Generate a lookup of Nugget key versus URL path'
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

      confluencePages(db, argv)
    } catch (err) {
      log.error(`ERROR: ${err}`)
      process.exit(1)
    }
  }
}
