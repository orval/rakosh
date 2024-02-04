'use strict'
import { writeFileSync, copyFileSync } from 'node:fs'
import { join } from 'node:path'

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

export async function generateHtml (catalog, dir, base, style, cssLink) {
  // this gets a chunk of markdown for each seam then for any remaining nuggets
  const [mdChunks, refs] = await catalog.getSeamNuggetMarkdown()

  const allMd = mdChunks.map(c => c + '\n---\n').join('\n')

  const tocMd = toc(allMd).content
  const wrapped = `\n<div class="container">\n\n${tocMd}\n\n${allMd}\n\n</div>\n`

  const htmlFile = join(dir, base + '.html')

  const output = await unified()
    .use(remarkParse)
    .use(remarkGfm)
    .use(remarkRehype, { allowDangerousHtml: true })
    .use(rehypeRaw)
    .use(rehypeHighlight)
    .use(rehypeSlug)
    .use(rehypeDocument, {
      title: catalog.allNuggets.adit.label,
      css: cssLink,
      style
    })
    .use(rehypeFormat)
    .use(rehypeStringify)
    .process(wrapped)

  const htmlAsString = String(output)

  writeFileSync(htmlFile, htmlAsString)

  // copy all media files to directory
  log.info(`copying media files to ${dir}`)
  for (const [uuidName, media] of Object.entries(refs)) {
    copyFileSync(media.relpath, join(dir, uuidName))
  }

  return htmlAsString
}
