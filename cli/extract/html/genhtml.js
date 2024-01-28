'use strict'
import { writeFileSync, copyFileSync, readFileSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'url'

import slugify from 'slugify'
import log from 'loglevel'
import toc from 'markdown-toc'
import rehypeSanitize from 'rehype-sanitize'
import remarkGfm from 'remark-gfm'
import rehypeHighlight from 'rehype-highlight'
import rehypeSlug from 'rehype-slug'
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

  const allMd = mdChunks.map(c => c + '\n---\n').join('\n')

  const tocMd = toc(allMd).content
  const htmlFile = join(argv.directory, slugify(argv.mine) + '.html')

  const processor = unified()
    .use(remarkParse)
    .use(remarkGfm)
    .use(remarkRehype)
    .use(rehypeSanitize)
    .use(rehypeHighlight)
    .use(rehypeSlug)
    .use(rehypeStringify)

  const body = processor.processSync(tocMd + '\n\n' + allMd).toString()

  const css = readFileSync(join(dirname(fileURLToPath(import.meta.url)), 'genhtml.css'))

  const html = [
    '<!DOCTYPE html>',
    '<head>',
    `<title>${catalog.allNuggets.adit.label}</title>`,
    `<style>${css}</style>`,
    '<link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/highlight.js/11.9.0/styles/dark.min.css">',
    '</head>',
    '<body>',
    '<div class="container">',
    body,
    '</div>',
    '</body>',
    '</html>'
  ]

  writeFileSync(htmlFile, html.join('\n'))

  // copy all media files to directory
  log.info(`copying media files to ${argv.directory}`)
  for (const [uuidName, media] of Object.entries(refs)) {
    copyFileSync(media.relpath, join(argv.directory, uuidName))
  }
}
