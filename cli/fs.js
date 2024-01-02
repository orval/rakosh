'use strict'
const { statSync } = require('node:fs')
const { dirname, resolve, extname } = require('node:path')

const log = require('loglevel')

const { FsLayout } = require('./lib/fs_layout')

log.setLevel('WARN')

exports.command = 'fs <action> <path> [<title>]'

exports.describe = 'Commands for operating on a rakosh filesystem layout'

exports.builder = (yargs) => {
  return yargs
    .option('interactive', {
      alias: 'i',
      hidden: true,
      boolean: true,
      describe: 'interactive filesystem operations'
    })
    .positional('action', {
      choices: ['add', 'lint']
      // describe: 'just check the layout is valid'
    })
    .positional('path', {
      describe: 'path to the entity to act on',
      string: true,
      normalize: true,
      coerce: p => {
        p = resolve(p)
        const dirPath = dirname(p)
        try {
          if (!statSync(dirPath).isDirectory()) throw new Error()
        } catch {
          throw new Error(`${dirPath} is not a directory`)
        }
        const ext = extname(p)
        if (ext !== '' && ext !== '.md') {
          throw new Error(`Unrecognised file type for ${p}`)
        }
        return p
      }
    })
    .positional('title', {
      describe: 'the title of the new nugget',
      type: 'string'
    })
    .check((argv) => {
      if (argv.action === 'lint' && argv.title) {
        log.warn('title ignored when linting')
      } else if (argv.action === 'add' && !argv.title) {
        throw new Error('title missing')
      }
      return true
    })
}

exports.handler = function (argv) {
  if (argv.verbose) log.setLevel('INFO')
  let fsLayout

  try {
    // lint takes path to adit's dir
    const path = (argv.action === 'add') ? dirname(argv.path) : argv.path
    fsLayout = new FsLayout(path)
  } catch (err) {
    log.error(`Failed to obtain FsLayout ${err}`)
    return false
  }

  if (argv.action === 'lint') {
    log.info(`found ${fsLayout.size()} nuggets`)
    return true
  }

  if (argv.interactive) {
    fsLayout.interactive()
  } else {
    fsLayout.add(argv.path, argv.title)
  }
}
