'use strict'
import { writeFileSync, copyFileSync } from 'node:fs'
import { join } from 'node:path'

import slugify from 'slugify'
import log from 'loglevel'
import toc from 'markdown-toc'
import rehypeSanitize from 'rehype-sanitize'
import rehypeStringify from 'rehype-stringify'
import remarkParse from 'remark-parse'
import remarkRehype from 'remark-rehype'
import { unified } from 'unified'

import { NuggetCatalog } from '../lib/nugget_catalog.js'

export async function generateHtml (db, argv) {
  log.info('generating html')

  const catalog = new NuggetCatalog(db, argv.include, argv.exclude)
  await catalog.init()

  // this gets a chunk of markdown for each seam then for any remaining nuggets
  const [mdChunks, refs] = await catalog.getSeamNuggetMarkdown()

  // create a TOC
  const allMd = mdChunks.join('\n')
  const tocMd = fixToc(toc(allMd, {
    firsth1: false,
    maxdepth: 2,
    bullets: '*'
  }).content)

  const htmlFile = join(argv.directory, slugify(argv.mine) + '.html')

  const processor = unified()
    .use(remarkParse)
    .use(remarkRehype)
    .use(rehypeSanitize)
    .use(rehypeStringify)

  const html = processor.processSync(tocMd + allMd).toString()
  writeFileSync(htmlFile, html)

  // copy all media files to directory
  log.info(`copying media files to ${argv.directory}`)
  for (const [uuidName, media] of Object.entries(refs)) {
    copyFileSync(media.relpath, join(argv.directory, uuidName))
  }

  // although MD007 requires two spaces in nested lists, some
  // parsers require four
  function fixToc (md) {
    return md.replace(/ {2}/g, '    ')
  }
}
