'use strict'
import { writeFileSync } from 'node:fs'

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

export async function generateHtml (catalog, output, style, cssLink) {
  // this gets a chunk of markdown for each seam then for any remaining nuggets
  const [mdChunks] = await catalog.getSeamNuggetMarkdown()

  const allMd = mdChunks.map(c => c + '\n---\n').join('\n')

  const tocMd = toc(allMd).content
  const wrapped = `\n<div class="container">\n\n${tocMd}\n\n${allMd}\n\n</div>\n`

  const html = await unified()
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

  const htmlAsString = String(html)
  writeFileSync(output, htmlAsString)

  return htmlAsString
}
