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

    // console.log('L', markdown.length)
    // if (markdown.length > 1500) console.log(slug)
    const sm = NuggetCatalog.truncateMd(markdown, 300)
    // console.log('S', sm.length)
    const jsonLine = { key: slug, markdown: slackifyMarkdown(markdown) }
    appendFileSync(output, JSON.stringify(jsonLine) + '\n')
  }
}
