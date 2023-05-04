'use strict'
const log = require('loglevel')
const { aql } = require('arangojs/aql')
const { mkdtempSync, writeFileSync } = require('node:fs')
const { tmpdir } = require('node:os')
const { join } = require('node:path')
const { Nugget } = require('../../lib/nugget')
const markdownpdf = require('markdown-pdf')

exports.generatePdf = async function (db, argv) {
  log.info('generating pdf')

  const allNuggets = await getAllNuggets(db)
  const tmpDir = mkdtempSync(join(tmpdir(), 'rakosh-genpdf-'))

  const mdFiles = {}
  const nugList = []

  // create a markdown file for each seam
  for (const seam of Object.values(allNuggets).filter(s => s.nuggets)) {
    const md = seam.nuggets.reduce((md, nug) => `${md}\n${allNuggets[nug].body}`, seam.body)
    mdFiles[seam._key] = writeMdFile(tmpDir, seam._key, md)
    nugList.push(seam._key, ...seam.nuggets)
  }

  // create a lookup of all nuggets written so far
  const writtenNugs = nugList.reduce((acc, cur) => { acc[cur] = 1; return acc }, {})

  // create a markdown file for each nugget not already written
  for (const nugget of Object.values(allNuggets).filter(n => !(n._key in writtenNugs))) {
    mdFiles[nugget._key] = writeMdFile(tmpDir, nugget._key, nugget.body)
  }

  markdownpdf().concat.from.paths(Object.values(mdFiles)).to(argv.output, () => {
    log.info(`created ${argv.output}`)
  })
}

async function getAllNuggets (db) {
  const cursor = await db.query(aql`
    FOR v, e, p IN 0..10000 OUTBOUND "passage/adit" GRAPH "primary"
      OPTIONS { uniqueVertices: "global", order: "weighted" }
      RETURN v
  `)

  const seamNugs = {}
  for await (const c of cursor) {
    seamNugs[c._key] = new Nugget(c)
  }
  return seamNugs
}

function writeMdFile (dir, name, md) {
  const path = join(dir, `${name}.md`)
  writeFileSync(path, md)
  return path
}
