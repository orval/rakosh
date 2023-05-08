'use strict'
const log = require('loglevel')
const { aql } = require('arangojs/aql')
const { mkdtempSync, writeFileSync } = require('node:fs')
const { tmpdir } = require('node:os')
const { join, dirname } = require('node:path')
const { Nugget } = require('../../lib/nugget')
const markdownpdf = require('markdown-pdf')

const HEADING_RE = /^(#+\s+\w+)$/m

// const through = require('through2')

// function preProcessHtml () {
//   return through(function (data, enc, cb) {
//     this.push(data)
//     cb()
//   })
// }

exports.generatePdf = async function (db, argv) {
  log.info('generating pdf')

  const allNuggets = await getAllNuggets(db)
  const tmpDir = mkdtempSync(join(tmpdir(), 'rakosh-genpdf-'))

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

  // create a kind of TOC
  const paths = await getPaths(db, mdFiles)

  const md = paths.map(p => {
    const parts = p.split('|')
    const last = parts.pop()
    return parts.map(p => allNuggets[p].label)
      .concat(`[${allNuggets[last].label}](#${last})`).join(' - ')
  })

  const orderedFiles = [writeMdFile(tmpDir, 'toc', md.join('\n') + '\n\n')]
  paths.forEach(p => orderedFiles.push(mdFiles[p.split('|').pop()]))

  markdownpdf({
    cssPath: join(dirname(__filename), 'pdf.css'),
    // preProcessHtml,
    remarkable: {
      preset: 'full',
      plugins: [plugin],
      syntax: ['abbreviations']
    }
  }).concat.from.paths(orderedFiles).to(argv.output, () => {
    log.info(`created ${argv.output}`)
  })

  // <a id="user-content-tocplugin" class="anchor" aria-hidden="true" href="#tocplugin">
  function getMd (allNuggets, acc, nug) {
    const parts = [acc]
    parts.push(allNuggets[nug].body.replace(HEADING_RE, `$1__${nug}__`))
    return parts.join('\n')
  }
}

function plugin (options) {
  const PLACEHOLDER_RE = /__([-0-9a-zA-Z]{36})__$/

  options.renderer.rules.heading_open = function (tokens, idx, options) {
    const tag = `h${tokens[idx].hLevel}`
    // console.log('HHH', tokens[idx], tokens[idx + 1])

    const match = tokens[idx + 1].content.match(PLACEHOLDER_RE)

    if (match) {
      tokens[idx + 1].content = 'FOO'
      return `<${tag} id="${match[1]}">`
    }

    return `<${tag}>`
  }
  // options.renderer.rules.inline = function (tokens, idx, options) {
  //   console.log('VVV', tokens[idx], tokens[idx - 1])
  //   if (tokens[idx].content.match(PLACEHOLDER_RE) &&
  //     tokens[idx - 1] && tokens[idx - 1].type === 'heading_open') {
  //     console.log('V', tokens[idx].content)
  //   }
  //   return tokens[idx].content
  // }
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
