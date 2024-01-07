'use strict'
const { mkdtempSync, writeFileSync, copyFileSync } = require('node:fs')
const { join, dirname } = require('node:path')
const { tmpdir } = require('node:os')

const log = require('loglevel')
const toc = require('markdown-toc')
const mdpdf = require('mdpdf')

const { NuggetCatalog } = require('../lib/nugget_catalog')

exports.generatePdf = async function (db, argv) {
  log.info('generating pdf')

  const catalog = new NuggetCatalog(db, argv.include, argv.exclude, argv.minlength)
  await catalog.init()

  // this gets a chunk of markdown for each seam then for any remaining nuggets
  const [mdChunks, refs] = await catalog.getSeamNuggetMarkdown()

  // create a TOC
  const allMd = mdChunks.join('\n')
  const tocMd = fixToc(toc(allMd, {
    firsth1: argv.toch1,
    maxdepth: argv.tocdepth,
    bullets: '*'
  }).content)

  // write markdown to file for use by mdpdf
  const tmpDir = mkdtempSync(join(tmpdir(), 'rakosh-genpdf-'))
  log.info(`writing temporary files to ${tmpDir}`)
  const mdFile = join(tmpDir, 'all.md')
  writeFileSync(mdFile, tocMd + '\n\n' + allMd)

  // copy all media files to temp dir
  for (const [uuidName, media] of Object.entries(refs)) {
    copyFileSync(media.relpath, join(tmpDir, uuidName))
  }

  // create the PDF
  const options = {
    source: mdFile,
    destination: argv.output,
    styles: join(dirname(__filename), 'pdf.css'),
    debug: join(tmpDir, 'debug.html'),
    pdf: {
      format: 'A4',
      orientation: 'portrait',
      border: { top: '2cm', left: '1cm', right: '1cm', bottom: '1.5cm' }
    }
  }

  mdpdf.convert(options).then((pdfPath) => {
    log.info(`${pdfPath} written`)
  }).catch((err) => {
    log.error(err)
  })

  // although MD007 requires two spaces in nested lists, some
  // parsers require four
  function fixToc (md) {
    return md.replace(/ {2}/g, '    ')
  }
}
