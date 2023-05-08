'use strict'
const { Database } = require('arangojs')
const { generatePdf } = require('./extract/pdf/genpdf')
const { include } = require('./lib/option_include')
const log = require('loglevel')

log.setLevel('WARN')

exports.command = 'pdf <mine> [--output]'

exports.describe = 'Extract the data from a mine and publish as pages in a PDF'

exports.builder = (yargs) => {
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
      description: 'Include <H1> headings in TOC'
    })
    .option('tocdepth', {
      type: 'number',
      default: 3,
      description: 'Depth of headings in TOC',
      coerce: m => {
        if (Number.isInteger(m) && m >= 0) return m
        throw new Error(`tocdepth value [${m}] is not valid`)
      }
    })
    .option('include', include)
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

    generatePdf(db, argv)
  } catch (err) {
    log.error(`ERROR: ${err}`)
    process.exit(1)
  }
}
