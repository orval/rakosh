'use strict'
import { appendFileSync, mkdirSync } from 'node:fs'
import { join, resolve } from 'node:path'

import slugify from 'slugify'
import log from 'loglevel'
import { LoremIpsum } from 'lorem-ipsum'

import { FsLayout } from './lib/fs_layout.js'

const GENTEST_NAME = 'Rakosh Test'
const DEPTH = 4
const BREADTH = 10
const NUGS = 3

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

    makePassages(argv.dir, fsLayout, 0)

    const check = new FsLayout(argv.dir)
    log.info(`created ${check.size()} entities`)
  }
}

function makePassages (parent, fsLayout, depth) {
  depth++
  for (let i = 0; i < BREADTH && depth < DEPTH; i++) {
    const dir = join(parent, slugify(lorem.generateWords(2)).toLowerCase())
    mkdirSync(dir)
    generateNuggets(fsLayout, dir)
    makePassages(dir, fsLayout, depth)
  }
}

function generateNuggets (fsLayout, dir) {
  for (let i = 1; i <= NUGS; i++) {
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
