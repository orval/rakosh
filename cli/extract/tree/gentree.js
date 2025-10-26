'use strict'

import log from 'loglevel'

import { NuggetCatalog } from '../lib/nugget_catalog.js'

import { generateTree } from './generateTree.js'

export async function genTree (db, argv) {
  log.info('extracting data')
  const catalog = new NuggetCatalog(db, argv.include, argv.exclude, false)
  await catalog.init()

  log.info('generating tree')
  await generateTree(
    catalog,
    argv.output
  )
}
