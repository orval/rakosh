'use strict'
const { statSync } = require('node:fs')
const { basename } = require('node:path')
const { Database } = require('arangojs')
const { FsLayout } = require('./lib/fs_layout')
const log = require('loglevel')

log.setLevel('WARN')

const RAKOSH_SCHEMA_VERSION = '1.0'

const PRIMARY = 'primary'
const PASSAGE = 'passage'
const EDGES = 'edges'
const NUGGET = 'nugget'
const ADIT = 'passage/adit'

exports.command = 'deposit <directory> [options]'

exports.describe = 'Deposit content from the filesystem into a mine'

exports.builder = (yargs) => {
  return yargs
    .positional('directory', {
      describe: 'Directory containing a rakosh mine layout',
      string: true,
      normalize: true,
      coerce: d => {
        try {
          if (!statSync(d).isDirectory()) throw new Error()
        } catch {
          throw new Error(`${d} is not a directory`)
        }
        return d
      }
    })
    .option('replace', {
      alias: 'r',
      describe: 'Replace the existing mine if it exists',
      type: 'boolean',
      default: false
    })
}

exports.handler = async function (argv) {
  try {
    if (argv.verbose) log.setLevel('INFO')

    log.info(`creating mine deposit from directory ${argv.directory}`)
    const fsLayout = new FsLayout(argv.directory)

    const dbName = basename(argv.directory)
    log.info(`mine is ${dbName}`)

    const conf = (process.env.ARANGO_URL) ? { url: process.env.ARANGO_URL } : {}
    const systemDb = new Database(conf)
    const databaseNames = await systemDb.listDatabases()

    if (databaseNames.includes(dbName)) {
      if (argv.replace) {
        log.info(`removing mine ${dbName}`)
        systemDb.dropDatabase(dbName)
      } else {
        log.error(`ERROR: mine ${dbName} already exists`)
        process.exit(1)
      }
    }

    log.info(`creating mine ${dbName}`)
    const db = await systemDb.createDatabase(dbName)

    await createGraph(db, fsLayout)
  } catch (err) {
    log.error(`ERROR: ${err}`)
    process.exit(1)
  }
}

async function createGraph (db, fsLayout) {
  log.info('creating primary graph')
  const graph = db.graph(PRIMARY)
  await graph.create([
    {
      collection: EDGES,
      from: [PASSAGE, NUGGET],
      to: [PASSAGE, NUGGET]
    }
  ])

  await deposit(graph, fsLayout)
}

async function deposit (graph, fsLayout) {
  const vPromises = []

  fsLayout.root.walk(async function (node) {
    if ('link' in node.model) return // links create edges only

    if (node.model._key === 'adit') {
      node.model.schema_version = RAKOSH_SCHEMA_VERSION
    }

    vPromises.push(graph.vertexCollection(node.model.type).save(node.model)
      .then(vertex => {
        log.info(`added vertex ${vertex._id}: ${node.model.label}`)
        node.model._id = vertex._id
      }))
  })

  await Promise.all(vPromises) // add edges after vertices are complete
  const ePromises = []
  const edges = {}

  fsLayout.root.walk(async function (node) {
    if (node.model._id === ADIT) return

    const _from = (node.parent) ? node.parent.model._id : ADIT
    const _to = (node.model._id) ? node.model._id : node.model.link

    edges[`${_from}__${_to}`] = 1 // save a unique list of from__to edge strings
    ePromises.push(graph.edgeCollection(EDGES).save({ _from, _to })
      .then(() => {
        log.info(`linked ${_from} to ${_to}`)
      })
      .catch(error => {
        log.error(`failed to link ${_from} to ${_to}: ${error.message}`)
      })
    )
  })

  await Promise.all(ePromises)

  // looks for seams and add edges to link nuggets together
  fsLayout.root.walk(async function (node) {
    if ('link' in node.model) return
    if (!('nuggets' in node.model)) return

    let _from = node.model._id
    for (const nug of node.model.nuggets) {
      const _to = `${NUGGET}/${nug}`

      // skip if edge has already been created
      if (`${_from}__${_to}` in edges) {
        _from = _to
        continue
      }

      await graph.edgeCollection(EDGES).save({ _from, _to })
        .then(() => {
          log.info(`seam linked ${_from} to ${_to}`)
          _from = _to
        })
        .catch(error => {
          log.error(`failed to seam link ${_from} to ${_to}: ${error.message}`)
        })
    }
  })
}
