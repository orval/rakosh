'use strict'
const { statSync, mkdirSync, accessSync, constants } = require('node:fs')
const { basename, dirname, join, resolve, extname } = require('node:path')
const log = require('loglevel')
const { FsLayout } = require('./lib/fs_layout')

log.setLevel('WARN')

exports.command = 'fs <path> <title>'
// exports.command = 'fs <action> <nugget_type> <path>'

exports.describe = 'Commands for operating on a rakosh filesystem layout'

exports.builder = (yargs) => {
  return yargs
    .option('interactive', {
      alias: 'i',
      hidden: true,
      describe: 'interactive filesystem operations'
    })

    // .option('create', {
    //   alias: 'c',
    //   describe: 'create a new nugget or passage',
    //   choices: ['nugget', 'n', 'passage', 'p'],
    //   default: 'passage' // ,
    //   // demandOption: true
    // })
    // .positional('action', {
    //   choices: ['create'],
    //   describe: 'create or ...',
    //   string: true
    // })
    // .positional('nugget_type', {
    //   choices: ['nugget', 'passage'],
    //   describe: 'the type of nugget to operate on',
    //   string: true
    // })
    // .positional('path', {
    //   describe: 'filesystem path to act upon',
    //   string: true,
    //   normalize: true,
    //   coerce: d => resolve(d)
    // })
    .positional('path', {
      describe: 'path to the entity to act on',
      string: true,
      normalize: true,
      coerce: p => {
        p = resolve(p)
        const dirPath = dirname(p)
        // const parts = p.split(path.sep)
        try {
          if (!statSync(dirPath).isDirectory()) throw new Error()
        } catch {
          throw new Error(`${dirPath} is not a directory`)
        }
        // const base = basename(p)
        const ext = extname(p)
        if (ext !== '' && ext !== '.md') {
          throw new Error(`Unrecognised file type for ${p}`)
        }
        // console.log(base, ext)
        return p
      }
    })
    .positional('title', {
      describe: 'the title of the new nugget',
      type: 'string'
    })
}

exports.handler = function (argv) {
  if (argv.verbose) log.setLevel('INFO')
  let fsLayout

  try {
    fsLayout = new FsLayout(dirname(argv.path))
  } catch (err) {
    // throw new Error(`Failed to blah ${err}`)
    log.error(`Failed to blah ${err}`)
    return false
  }

  if (argv.interactive) {
    fsLayout.interactive()
  } else {
    fsLayout.add(argv.path, argv.title)
  }

  // root = tree.parse({ depth: 1, chunks: [], ...this.allNuggets.adit })
  // assert.strictEqual(c.keys, 'adit', 'first vertex should be "adit"')

  // if (argv.action === 'create') {
  //   if (argv.nugget_type === 'passage') {
  //     fileExists(argv.path)

  //     if (!statSync(argv.path).isDirectory()) {
  //       // mkdirSync(argv.path)
  //       console.log('sadsad')
  //       // process.exit(1)
  //     }
  //   }
  // }

  // log.warn(`${argv.action} ${argv.nugget_type} [${argv.path}]`)
}

function fileExists (filepath) {
  try {
    accessSync(filepath, constants.R_OK | constants.W_OK)
  } catch (err) {
    if (err.code === 'ENOENT') {
      console.error('File does not exist')
    } else {
      console.error('Error occurred:', err)
    }

    console.error(err)
    console.error('no access!')
    process.exit()
  }
}

function buildGraph (graph, parentVertex, path) {
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
        // await graph.vertexCollection(PASSAGE).update('adit', nugget.document)
        continue
      }

      if ('passage' in nugget) {
        log.info(`saving passage ${base}`)
        passageNuggets[nugget.passage] = nugget
      } else {
        log.info(`creating nugget ${base}`)
        // const vertex = await graph.vertexCollection(NUGGET).save(nugget.document)

        // seam head edge will be created in createSeams
        if (parentVertex.nuggets && vertex._key === parentVertex.nuggets[0]) {
          continue
        }

        // await graph.edgeCollection(EDGES).save({ _from: parentVertex._id, _to: vertex._id })
      }
    }
  }

  for (const dir of dirs) {
    const doc = (dir.name in passageNuggets)
      ? passageNuggets[dir.name].document
      : { label: dir.name, passage: dir.name, fspath: join(path, dir.name) }

    // create a package vertex and recurse down the directory tree
    log.info(`creating passage ${dir.name} ${doc.label}`)
    // const passageVertex = await graph.vertexCollection(PASSAGE).save(doc)
    const dirPath = join(path, dir.name)

    passageLookup[resolve(dirPath)] = passageVertex._id
    // await graph.edgeCollection(EDGES).save({ _from: parentVertex._id, _to: passageVertex._id })

    delete passageNuggets[dir.name]
    doc._id = passageVertex._id
    // await buildGraph(graph, doc, dirPath)
  }

  if (Object.keys(passageNuggets).length > 0) {
    log.warn(`WARNING: saved nugget passage(s) not added to collection [${JSON.stringify(passageNuggets)}]`)
  }
}
