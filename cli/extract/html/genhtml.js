'use strict'

import slugify from 'slugify'
import log from 'loglevel'

import { NuggetCatalog } from '../lib/nugget_catalog.js'

import { generateHtml } from './generateHtml.js'

export async function genHtml (db, argv) {
  log.info('generating html')

  const catalog = new NuggetCatalog(db, argv.include, argv.exclude, true)
  await catalog.init()

  // this gets a chunk of markdown for each seam then for any remaining nuggets
  await generateHtml(catalog, argv.directory, slugify(argv.mine))
}
