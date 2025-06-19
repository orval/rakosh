'use strict'

import log from 'loglevel'

import { NuggetCatalog } from '../lib/nugget_catalog.js'

import { generateSlack } from './generateSlack.js'

export async function genSlack (db, argv) {
  log.info('extracting data')
  const catalog = new NuggetCatalog(db, argv.include, argv.exclude, true)
  await catalog.init()

  log.info('generating slack data')
  await generateSlack(
    catalog,
    argv.output
  )
}
