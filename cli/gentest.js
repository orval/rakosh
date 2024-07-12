'use strict'
import { appendFileSync, mkdirSync } from 'node:fs'
import { join, resolve } from 'node:path'

import slugify from 'slugify'
import log from 'loglevel'
import { LoremIpsum } from 'lorem-ipsum'

import { FsLayout } from './lib/fs_layout.js'

const GENTEST_NAME = 'Rakosh Test'
const DEPTH = 3

const lorem = new LoremIpsum()

log.setLevel('WARN')

export default {
  command: 'gentest <dir>',
  describe: false, // 'Command for generating rakosh test data',
  builder: (yargs) => {
    return yargs
      .positional('dir', {
        describe: 'name of directory to create',
        string: true,
        normalize: true,
        coerce: d => {
          d = resolve(d)
          mkdirSync(d)
          return d
        }
      })
      .check((argv) => {
        return true
      })
  },

  handler: (argv) => {
    if (argv.verbose) log.setLevel('INFO')
    let fsLayout

    try {
      fsLayout = new FsLayout(argv.dir)
    } catch (err) {
      log.error(`Failed to obtain FsLayout ${err}`)
      return false
    }

    fsLayout.createAdit(join(argv.dir, slugify(GENTEST_NAME).toLowerCase() + '.md'), GENTEST_NAME)

    let parentDir = argv.dir
    for (let i = 1; i <= DEPTH; i++) {
      parentDir = makePassage(parentDir, fsLayout)
    }

    const check = new FsLayout(argv.dir)
    log.info(`created ${check.size()} entities`)
  }
}

function makePassage (parent, fsLayout) {
  const dir = join(parent, slugify(lorem.generateWords(2)).toLowerCase())
  mkdirSync(dir)
  generateNuggets(fsLayout, dir)
  return dir
}

function generateNuggets (fsLayout, dir) {
  for (let i = 1; i <= 5; i++) {
    // mkdirSync(dir)
    const title = lorem.generateWords(3)
    const nugPath = join(dir, slugify(title).toLowerCase() + '.md')
    fsLayout.add(nugPath, title)
    appendContent(nugPath)
  }
}

function appendContent (path) {
  appendFileSync(path, `
${lorem.generateParagraphs(1)}

${lorem.generateParagraphs(1)}
`)
}
