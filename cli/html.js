'use strict'
const { statSync, existsSync, mkdirSync } = require('node:fs')

const { Database } = require('arangojs')
const log = require('loglevel')

const { generateHtml } = require('./extract/html/genhtml')
const { exclude } = require('./lib/option_exclude')
const { include } = require('./lib/option_include')

log.setLevel('WARN')

exports.command = 'html <mine> [<directory>]'

exports.describe = 'Extract the data from a mine and publish as an HTML document'

exports.builder = (yargs) => {
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

    generateHtml(db, argv)
  } catch (err) {
    log.error(`ERROR: ${err}`)
    process.exit(1)
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
