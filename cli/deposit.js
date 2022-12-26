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
const LODE = 'lode'
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
      from: [PASSAGE, LODE, SEAM, NUGGET],
      to: [PASSAGE, LODE, SEAM, NUGGET]
    }
  ])

  await depositLodes(graph, directory)
  await createLinks(graph, directory)
  await createSeams(db, graph)
}

async function depositLodes (graph, directory) {
  // a single passage vertex sits atop the mine
  const adit = await graph.vertexCollection(PASSAGE).save({ _key: 'adit' })

  log.info('creating lodes')

  const dirContents = readdirSync(directory, { withFileTypes: true })
  for (const dirent of dirContents.filter(e => e.isDirectory())) {
    // there must be a markdown file that matches the lode directory name
    const lodeMdFile = `${dirent.name}.md`
    const lodeMdEntry = dirContents.find(f => f.name === lodeMdFile && f.isFile())

    if (!lodeMdEntry) {
      log.error(`ERROR: missing markdown file ${lodeMdFile} for lode`)
      continue
    }

    log.info(`creating lode ${dirent.name}`)
    const lodeNugget = new Nugget(resolve(join(directory, lodeMdFile)))
    const lodeVertex = await graph.vertexCollection(LODE).save(lodeNugget.document)
    await graph.edgeCollection(EDGES).save({ _from: adit._id, _to: lodeVertex._id })

    await deposit(graph, lodeVertex, resolve(join(directory, dirent.name))) // recurse down the directory tree
  }
}

async function deposit (graph, parentVertex, absolutePath) {
  const dirContents = readdirSync(absolutePath, { withFileTypes: true })

  for (const dirent of dirContents) {
    if (dirent.isDirectory()) {
      // create a package vertex and recurse down the directory tree
      log.info(`creating passage ${dirent.name}`)
      const passageVertex = await graph.vertexCollection(PASSAGE).save({ label: dirent.name })
      const dirPath = join(absolutePath, dirent.name)

      passageLookup[dirPath] = passageVertex._id
      await graph.edgeCollection(EDGES).save({ _from: parentVertex._id, _to: passageVertex._id })

      await deposit(graph, passageVertex, dirPath)
      continue
    }

    // process markdown files
    if (dirent.isFile() && extname(dirent.name) === '.md') {
      const base = basename(dirent.name, '.md')

      // only look at files named <UUID>.md
      if (uuidRe.test(base)) {
        const nugget = new Nugget(resolve(join(absolutePath, dirent.name)))
        let collection = NUGGET

        // a seam is a special flavour of nugget and goes in the SEAM collection
        if ('seam' in nugget) {
          log.info(`creating seam ${base}`)
          collection = SEAM
        } else {
          log.info(`creating nugget ${base}`)
        }

        const vertex = await graph.vertexCollection(collection).save(nugget.document)
        await graph.edgeCollection(EDGES).save({ _from: parentVertex._id, _to: vertex._id })
      }
    }
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
