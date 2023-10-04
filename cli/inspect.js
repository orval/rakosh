'use strict'
const { statSync, readdirSync } = require('node:fs')
const { basename, join, resolve, extname } = require('node:path')
const { Nugget } = require('rakosh/cli/lib/nugget')
const log = require('loglevel')

log.setLevel('WARN')

const RAKOSH_FS_LAYOUT_VERSION = '1.1'

exports.command = 'inspect <directory> [options]'

exports.describe = 'Inspect mine (check markdown)'

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
}

exports.handler = async function (argv) {
  if (argv.verbose) log.setLevel('INFO')

  log.info(`inspecting mine deposit from directory ${argv.directory}`)
  inspect(argv.directory)
}

function inspect(path) {
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
      log.info(`inspecting nugget ${mdFile.name}`)
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
        continue
      }

      if ('passage' in nugget) {
        log.info(`saving passage ${base}`)
        passageNuggets[nugget.passage] = nugget
      }
    }
  }

  for (const dir of dirs) {
    const doc = (dir.name in passageNuggets)
      ? passageNuggets[dir.name].document
      : { label: dir.name, passage: dir.name, fspath: join(path, dir.name) }

    log.info(`inspecting passage ${dir.name} ${doc.label}`)
    const dirPath = join(path, dir.name)

    delete passageNuggets[dir.name]
    inspect(dirPath)
  }

  if (Object.keys(passageNuggets).length > 0) {
    log.warn(`WARNING: saved nugget passage(s) not added to collection [${JSON.stringify(passageNuggets)}]`)
  }
}