'use strict'
import { writeFileSync, appendFileSync } from 'node:fs'

import slackifyMarkdown from 'slackify-markdown'

import { NuggetCatalog } from '../lib/nugget_catalog.js'

export async function generateSlack (catalog, output) {
  writeFileSync(output, '')

  const nugs = await catalog.getAllNuggets()
  for (const [nugget, slug] of nugs) {
    const markdown = nugget.body
    if (!markdown) continue

    const sm = NuggetCatalog.truncateMd(markdown, 1000)
    const jsonLine = { key: slug, markdown: slackifyMarkdown(sm) }
    appendFileSync(output, JSON.stringify(jsonLine) + '\n')
  }
}
