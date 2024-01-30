'use strict'
import { writeFileSync, copyFileSync, readFileSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'url'

import slugify from 'slugify'
import log from 'loglevel'
import toc from 'markdown-toc'
import remarkGfm from 'remark-gfm'
import rehypeDocument from 'rehype-document'
import rehypeFormat from 'rehype-format'
import rehypeHighlight from 'rehype-highlight'
import rehypeRaw from 'rehype-raw'
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
  const wrapped = `\n<div class="container">\n\n${tocMd}\n\n${allMd}\n\n</div>\n`

  const htmlFile = join(argv.directory, slugify(argv.mine) + '.html')
  const style = readFileSync(join(dirname(fileURLToPath(import.meta.url)), 'genhtml.css'))

  const output = await unified()
    .use(remarkParse)
    .use(remarkGfm)
    .use(remarkRehype, { allowDangerousHtml: true })
    .use(rehypeRaw)
    .use(rehypeHighlight)
    .use(rehypeSlug)
    .use(rehypeDocument, {
      title: catalog.allNuggets.adit.label,
      css: 'https://cdnjs.cloudflare.com/ajax/libs/highlight.js/11.9.0/styles/github-dark.min.css',
      style: String(style)
    })
    .use(rehypeFormat)
    .use(rehypeStringify)
    .process(wrapped)

  writeFileSync(htmlFile, String(output))

  // copy all media files to directory
  log.info(`copying media files to ${argv.directory}`)
  for (const [uuidName, media] of Object.entries(refs)) {
    copyFileSync(media.relpath, join(argv.directory, uuidName))
  }
}
