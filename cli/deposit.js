'use strict'
const { statSync, readdirSync } = require('node:fs')
const { basename, join, resolve, extname } = require('node:path')
const { Database } = require('arangojs')
const { aql } = require('arangojs/aql')
const { Nugget } = require('../lib/nugget')
const log = require('loglevel')

log.setLevel('WARN')

const PRIMARY = 'primary'
const PASSAGE = 'passage'
const EDGES = 'edges'
const SEAM = 'seam'
const NUGGET = 'nugget'

const uuidRe = /^[0-9a-fA-F]{8}-(?:[0-9a-fA-F]{4}-){3}[0-9a-fA-F]{12}$/

const passageLookup = {}

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

    const dbName = basename(argv.directory)
    log.info(`mine is ${dbName}`)

    const systemDb = new Database()
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

    await createGraph(db, argv.directory)
  } catch (err) {
    log.error(`ERROR: ${err}`)
    process.exit(1)
  }
}

async function createGraph (db, directory) {
  log.info('creating primary graph')
  const graph = db.graph(PRIMARY)
  await graph.create([
    {
      collection: EDGES,
      from: [PASSAGE, SEAM, NUGGET],
      to: [PASSAGE, SEAM, NUGGET]
    }
  ])

  const adit = await graph.vertexCollection(PASSAGE).save({ _key: 'adit' })
  await deposit(graph, adit, directory)
  await createLinks(graph, directory)
  await createSeams(db, graph)
}

async function deposit (graph, parentVertex, path) {
  const dirContents = readdirSync(path, { withFileTypes: true })
  const mdFiles = dirContents.filter(e => e.isFile() && extname(e.name) === '.md')
  const dirs = dirContents.filter(e => e.isDirectory())
  const passageNuggets = {}

  // process markdown files
  for (const mdFile of mdFiles) {
    const base = basename(mdFile.name, '.md')

    // only look at files named <UUID>.md
    if (uuidRe.test(base)) {
      const nugget = new Nugget(resolve(join(path, mdFile.name)))
      let collection = NUGGET

      // a seam is a special flavour of nugget and goes in the SEAM collection
      if ('type' in nugget && nugget.type === 'seam') {
        log.info(`creating seam ${base}`)
        collection = SEAM
      }

      if ('passage' in nugget) {
        log.info(`saving passage ${base}`)
        passageNuggets[nugget.passage] = nugget
      } else {
        log.info(`creating nugget ${base}`)
        const vertex = await graph.vertexCollection(collection).save(nugget.document)
        await graph.edgeCollection(EDGES).save({ _from: parentVertex._id, _to: vertex._id })
      }
    } else if (base === graph._db._name) {
      // update the adit vertex with a document from this file
      const adit = new Nugget(resolve(join(path, mdFile.name)))
      await graph.vertexCollection(PASSAGE).update('adit', adit.document)
    }
  }

  for (const dir of dirs) {
    const doc = (dir.name in passageNuggets)
      ? passageNuggets[dir.name].document
      : { label: dir.name }

    // create a package vertex and recurse down the directory tree
    log.info(`creating passage ${dir.name} ${doc.label}`)
    const passageVertex = await graph.vertexCollection(PASSAGE).save(doc)
    const dirPath = join(path, dir.name)

    passageLookup[resolve(dirPath)] = passageVertex._id
    await graph.edgeCollection(EDGES).save({ _from: parentVertex._id, _to: passageVertex._id })

    await deposit(graph, passageVertex, dirPath)
  }
}

async function createLinks (graph, directory) {
  const dirContents = readdirSync(directory, { withFileTypes: true })
  for (const dirent of dirContents) {
    if (dirent.isDirectory()) {
      createLinks(graph, resolve(join(directory, dirent.name)))
    } else if (dirent.isSymbolicLink() && extname(dirent.name) === '.md') {
      const base = basename(dirent.name, '.md')

      if (!passageLookup[directory]) {
        log.error(`ERROR: cannot find passage vertex for ${base} with path ${directory}`)
        continue
      }

      log.info(`creating link from ${passageLookup[directory]} to ${base}`)
      try {
        await graph.edgeCollection(EDGES).save({
          _from: passageLookup[directory],
          _to: `nugget/${base}`
        })
      } catch (err) {
        log.error(`ERROR: code ${err.code} linking ${passageLookup[directory]} to ${dirent.name}`)
      }
    }
  }
}

async function createSeams (db, graph) {
  try {
    const collection = db.collection(SEAM)
    const cursor = await db.query(aql`
      FOR doc IN ${collection}
      RETURN doc
    `)

    for await (const seam of cursor) {
      if (!('nuggets' in seam)) {
        log.warn(`WARNING: seam ${seam._id} has no nuggets`)
        continue
      }

      let from = seam._id

      for (const nugget of seam.nuggets) {
        const nuggetId = `nugget/${nugget}`

        log.info(`creating link from ${from} to ${nuggetId}`)
        try {
          await graph.edgeCollection(EDGES).save({
            _from: from,
            _to: nuggetId
          })
        } catch (err) {
          log.error(`ERROR: code ${err.code} linking ${from} to ${nuggetId}`)
        }

        from = nuggetId
      }
    }
  } catch (err) {
    log.error(`ERROR: exception during seam creation: ${err}`)
  }
}
