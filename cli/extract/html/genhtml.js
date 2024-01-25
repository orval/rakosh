'use strict'
const { writeFileSync, copyFileSync } = require('node:fs')
const { join } = require('node:path')

const slugify = require('slugify')
const rehypeSanitize = require('fix-esm').require('rehype-sanitize').default
const rehypeStringify = require('fix-esm').require('rehype-stringify').default
const remarkParse = require('fix-esm').require('remark-parse').default
const remarkRehype = require('fix-esm').require('remark-rehype').default
const { unified } = require('fix-esm').require('unified')
const log = require('loglevel')
const toc = require('markdown-toc')

const { NuggetCatalog } = require('../lib/nugget_catalog')

exports.generateHtml = async function (db, argv) {
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
