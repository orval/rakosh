'use strict'
const log = require('loglevel')
const { aql } = require('arangojs/aql')
const { mkdtempSync, writeFileSync, createWriteStream, createReadStream, readFileSync } = require('node:fs')
const { tmpdir } = require('node:os')
const { join, dirname } = require('node:path')
const { Nugget } = require('../../lib/nugget')
const mdpdf = require('mdpdf')
const toc = require('markdown-toc')

exports.generatePdf = async function (db, argv) {
  log.info('generating pdf')

  const allNuggets = await getAllNuggets(db)
  const tmpDir = mkdtempSync(join(tmpdir(), 'rakosh-genpdf-'))
  log.info(`writing temporary files to ${tmpDir}`)

  const mdFiles = {}
  const nugList = []

  // create a markdown file for each seam
  for (const seam of Object.values(allNuggets).filter(s => s.nuggets)) {
    const seamBody = getMd(allNuggets, '', seam._key)
    const md = seam.nuggets.reduce((acc, nug) => getMd(allNuggets, acc, nug), seamBody)
    mdFiles[seam._key] = writeMdFile(tmpDir, seam._key, md)
    nugList.push(seam._key, ...seam.nuggets)
  }

  // create a lookup of all nuggets written so far
  const writtenNugs = nugList.reduce((acc, cur) => { acc[cur] = 1; return acc }, {})

  // create a markdown file for each nugget not already written
  for (const nugget of Object.values(allNuggets).filter(n => !(n._key in writtenNugs))) {
    if (!nugget.body) continue
    mdFiles[nugget._key] = writeMdFile(tmpDir, nugget._key, nugget.body)
  }

  // create a TOC only using paths for ordering at the moment
  const paths = await getPaths(db, mdFiles)

  // put the files into the order defined by `paths`
  const orderedFiles = []
  paths.forEach(p => orderedFiles.push(mdFiles[p.split('|').pop()]))

  // create the PDF
  await concatFiles(tmpDir, orderedFiles)
    .then((inputFile) => {
      const content = readFileSync(inputFile, { encoding: 'utf-8' })
      const tmp = join(tmpDir, 'tmp.md')
      writeFileSync(tmp, toc(content, { firsth1: false, maxdepth: 2 }).content + '\n' + content)
      const options = {
        source: tmp,
        destination: argv.output,
        styles: join(dirname(__filename), 'pdf.css'),
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
    })

  function getMd (allNuggets, acc, nug) {
    const parts = [acc]
    parts.push(allNuggets[nug].body)
    return parts.join('\n')
  }
}

function concatFiles (tmpDir, fileList) {
  const output = join(tmpDir, 'all.md')

  return new Promise((resolve, reject) => {
    const outputStream = createWriteStream(output)

    fileList.forEach(filepath => {
      const inputStream = createReadStream(filepath)
      inputStream.pipe(outputStream)
    })

    outputStream.on('finish', () => {
      resolve(output)
    })

    outputStream.on('error', err => {
      reject(err)
    })
  })
}

async function getAllNuggets (db) {
  const cursor = await db.query(aql`
    FOR v, e, p IN 0..10000 OUTBOUND "passage/adit" GRAPH "primary"
      OPTIONS { uniqueVertices: "global", order: "weighted" }
      RETURN v
  `)

  const nugs = {}
  for await (const c of cursor) {
    nugs[c._key] = new Nugget(c)
  }
  return nugs
}

function writeMdFile (dir, name, md) {
  const path = join(dir, `${name}.md`)
  writeFileSync(path, md)
  return path
}

async function getPaths (db, mdFiles) {
  const cursor = await db.query(aql`
    FOR v, e, p IN 0..10000 OUTBOUND 'passage/adit' GRAPH 'primary'
      PRUNE v.nuggets
      LET vertices = (
          FOR vertex IN p.vertices
              LET order_value = vertex.order == null ? 10000 : vertex.order
              RETURN MERGE(vertex, { order: order_value })
      )
      SORT vertices[*].order ASC, vertices[*].label ASC
      RETURN CONCAT_SEPARATOR("|", vertices[*]._key)
  `)

  const paths = []
  for await (const c of cursor) {
    if (c.split('|').pop() in mdFiles) paths.push(c)
  }
  return paths
}
