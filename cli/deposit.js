'use strict'
const { statSync, readdirSync } = require('node:fs')
const { basename, join, resolve, extname } = require('node:path')
const { Database } = require('arangojs')
const { aql } = require('arangojs/aql')
const { Nugget } = require('./lib/nugget')
const log = require('loglevel')

log.setLevel('WARN')

const RAKOSH_SCHEMA_VERSION = '1.0'
const RAKOSH_FS_LAYOUT_VERSION = '1.1'

const PRIMARY = 'primary'
const PASSAGE = 'passage'
const EDGES = 'edges'
const NUGGET = 'nugget'

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
      from: [PASSAGE, NUGGET],
      to: [PASSAGE, NUGGET]
    }
  ])

  const adit = await graph.vertexCollection(PASSAGE).save({
    _key: 'adit',
    schema_version: RAKOSH_SCHEMA_VERSION
  })

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
    const fsPath = join(path, mdFile.name)

    // check all markdown files
    if (mdFile.name.endsWith('.md')) {
      let nugget
      try {
        nugget = Nugget.fromMdFile(resolve(fsPath))
        nugget.fspath = fsPath
      } catch (error) {
        log.warn(`WARNING: ${mdFile.name} does not appear to be a rakosh nugget file [${error}]`)
        continue
      }

      if (nugget._key === 'adit') {
        // check for presence of layout version -- allow for later version changes
        if (!nugget.fs_layout) {
          log.warn(`WARNING: no 'fs_layout' in ${base}.md, assuming version ${RAKOSH_FS_LAYOUT_VERSION}`)
        } else if (nugget.fs_layout !== RAKOSH_FS_LAYOUT_VERSION) {
          log.error(`ERROR: unknown 'fs_layout' ${nugget.fs_layout}, tool knows ${RAKOSH_FS_LAYOUT_VERSION}`)
        }
        // update the adit vertex with a document from this file
        await graph.vertexCollection(PASSAGE).update('adit', nugget.document)
        continue
      }

      if ('passage' in nugget) {
        log.info(`saving passage ${base}`)
        passageNuggets[nugget.passage] = nugget
      } else {
        log.info(`creating nugget ${base}`)
        const vertex = await graph.vertexCollection(NUGGET).save(nugget.document)
        await graph.edgeCollection(EDGES).save({ _from: parentVertex._id, _to: vertex._id })
      }
    }
  }

  for (const dir of dirs) {
    const doc = (dir.name in passageNuggets)
      ? passageNuggets[dir.name].document
      : { label: dir.name, passage: dir.name, fspath: join(path, dir.name) }

    // create a package vertex and recurse down the directory tree
    log.info(`creating passage ${dir.name} ${doc.label}`)
    const passageVertex = await graph.vertexCollection(PASSAGE).save(doc)
    const dirPath = join(path, dir.name)

    passageLookup[resolve(dirPath)] = passageVertex._id
    await graph.edgeCollection(EDGES).save({ _from: parentVertex._id, _to: passageVertex._id })

    delete passageNuggets[dir.name]
    await deposit(graph, passageVertex, dirPath)
  }

  if (Object.keys(passageNuggets).length > 0) {
    log.warn(`WARNING: saved nugget passage(s) not added to collection [${JSON.stringify(passageNuggets)}]`)
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

      const nug = Nugget.fromMdFile(resolve(join(directory, dirent.name)))
      const id = nug.type + '/' + nug._key

      log.info(`creating link from ${passageLookup[directory]} to ${id}`)
      try {
        await graph.edgeCollection(EDGES).save({
          _from: passageLookup[directory],
          _to: id
        })
      } catch (err) {
        log.error(`ERROR: code ${err.code} linking ${passageLookup[directory]} to ${id}`)
      }
    }
  }
}

async function createSeams (db, graph) {
  try {
    // an array of nuggets means this nugget has a seam
    const cursor = await db.query(aql`
      FOR n IN nugget
        FILTER n.nuggets
        RETURN n
    `)

    for await (const nugget of cursor) {
      let from = nugget._id

      for (const nug of nugget.nuggets) {
        const nuggetId = `nugget/${nug}`

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
