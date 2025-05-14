'use strict'
import { statSync } from 'node:fs'
import { dirname, resolve, extname } from 'node:path'

import log from 'loglevel'

import { FsLayout } from './lib/fs_layout.js'

log.setLevel('WARN')

export default {
  command: 'fs <command>',
  describe: 'Commands for operating on a rakosh filesystem layout',

  builder: (yargs) => {
    return yargs
      .command(
        'lint <path>',
        'Lint files in a rakosh filesystem layout',
        yargs => yargs
          .positional('path', {
            describe: 'path to a directory containing an "adit" nugget',
            string: true,
            normalize: true,
            coerce: p => {
              p = resolve(p)
              try {
                if (!statSync(p).isDirectory()) throw new Error()
              } catch {
                throw new Error(`${p} is not a directory`)
              }
              return p
            }
          }),
        argv => {
          if (argv.verbose) log.setLevel('INFO')
          let fsLayout

          try {
            fsLayout = new FsLayout(argv.path)
          } catch (err) {
            log.error(`Failed to obtain FsLayout ${err}`)
            return false
          }

          log.info(`Found ${fsLayout.size()} nuggets`)
          return true
        }
      )
      .command(
        'add <path> <title>',
        'Add a new rakosh nugget or passage',
        yargs => yargs
          .positional('path', {
            describe: 'Path to the nugget or passage',
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
            describe: 'Title of the new nugget',
            type: 'string'
          }),
        argv => {
          if (argv.verbose) log.setLevel('INFO')
          let fsLayout

          try {
            fsLayout = new FsLayout(dirname(argv.path))
          } catch (err) {
            log.error(`Failed to obtain FsLayout ${err}`)
            return false
          }

          fsLayout.add(argv.path, argv.title)
          return true
        }
      )
  }
}
