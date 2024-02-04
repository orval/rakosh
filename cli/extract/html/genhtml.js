'use strict'

import { readFileSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'url'

import slugify from 'slugify'
import log from 'loglevel'

import { NuggetCatalog } from '../lib/nugget_catalog.js'

import { generateHtml } from './generateHtml.js'

export async function genHtml (db, argv) {
  log.info('extracting data')
  const catalog = new NuggetCatalog(db, argv.include, argv.exclude, true)
  await catalog.init()

  log.info('generating html')
  await generateHtml(
    catalog,
    argv.directory,
    slugify(argv.mine),
    String(readFileSync(join(dirname(fileURLToPath(import.meta.url)), 'genhtml.css'))),
    'https://cdnjs.cloudflare.com/ajax/libs/highlight.js/11.9.0/styles/github-dark.min.css'
  )
}
