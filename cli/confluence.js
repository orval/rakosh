'use strict'
const { Database } = require('arangojs')
const { confluencePages } = require('./extract/confluence/pages')
const log = require('loglevel')

log.setLevel('WARN')

exports.command = 'confluence <mine> <spacekey> <startpageid> [--ccauth]'

exports.describe = 'Extract the data from a mine and publish as pages to Confluence Cloud'

exports.builder = (yargs) => {
  return yargs
    .positional('mine', {
      describe: 'The name of the mine to extract',
      string: true
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
    .env('RAKOSH')
    .option('ccauth', {
      description: 'Confluence Cloud credentials in format <your_email@domain.com>:<your_user_api_token>',
      default: process.env.RAKOSH_CC_AUTH
    })
    .check((argv) => {
      if (!argv.ccauth) {
        log.error('rakosh requires Confluence Cloud credentials in format <your_email@domain.com>:<your_user_api_token>')
        log.error('Either set RAKOSH_CCAUTH in the environment or use --ccauth')
        return false
      }
      return true
    })
}

exports.handler = async function (argv) {
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
