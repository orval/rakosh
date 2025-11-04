'use strict'

import log from 'loglevel'

import { NuggetCatalog } from '../lib/nugget_catalog.js'

import { generateTree } from './generateTree.js'

export async function genTree (db, argv) {
  log.info('extracting data')
  const catalog = new NuggetCatalog(db, argv.include, argv.exclude, false)
  await catalog.init()
  const root = await catalog.getSeamNuggetTree()

  if (argv.treedebug) {
    root.walk((n) => {
      const nugget = catalog.fromNode(n)
      const path = n.getPath().map(p => catalog.fromNode(p).label).slice(1).join('/')
      console.log(`[${path}]`, nugget)
    })
    return
  }

  log.info('generating tree')
  await generateTree(
    catalog,
    argv.directory
  )
}
