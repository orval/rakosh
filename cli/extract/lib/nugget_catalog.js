'use strict'
const assert = require('assert')
const { aql, join } = require('arangojs/aql')
const { Nugget } = require('../../lib/nugget')
const TreeModel = require('tree-model')

exports.NuggetCatalog = class NuggetCatalog {
  static HEADING_RE = /^(#+)\s+(.+)$/gm

  constructor (db, includes = [], excludes = [], minLength) {
    this.db = db
    this.includes = includes
    this.excludes = excludes
    this.minLength = minLength
    this.allNuggets = {}
    this.seamNuggetChunks = {}
    this.initialised = false

    this.filters = []
    this.includes.forEach(inc => this.filters.push(
      aql`FILTER v.${inc.key} == ${inc.value}`
    ))
    this.excludes.forEach(exc => this.filters.push(
      aql`FILTER v.${exc.key} != ${exc.value}`
    ))
  }

  async init () {
    const cursor = await this.db.query(aql`
      FOR v, e, p IN 0..10000 OUTBOUND "passage/adit" GRAPH "primary"
        OPTIONS { uniqueVertices: "global", order: "weighted" }
        ${join(this.filters)}
        RETURN v
    `)

    // for now all nuggets are pulled into memory
    for await (const c of cursor) {
      this.allNuggets[c._key] = new Nugget(c)
    }

    this.initialised = true
  }

  // get an ordered array of markdown chunks with metadata
  async getOrdered () {
    // ordering is determined by walking the tree
    const treeRoot = await this.getTree()

    // put the files into the order defined by the tree
    const orderedChunks = []

    treeRoot.walk((node) => {
      // empty passage leaf nodes are skipped
      if (node.model.length === 0 && !node.hasChildren() && node.model.type === 'passage') {
        return true
      }

      const md = this.#mdForExtract(node.model.key, node.model.depth)
      if (md && this.#allowExtract(md)) {
        const chunk = { chunk: this.rewriteHeadings(md, node.model.depth), ...node.model }
        orderedChunks.push(chunk)
      }
      return true
    })
    return orderedChunks
  }

  // get markdown chunks for seams then any non-seam nuggets
  populateChunks () {
    this.initCheck()

    const nugList = []

    // create a markdown chunk for each seam
    for (const seam of Object.values(this.allNuggets).filter(s => s.nuggets)) {
      const seamBody = this.getMd('', seam._key)
      this.seamNuggetChunks[seam._key] = seam.nuggets.reduce((acc, key) => this.getMd(acc, key), seamBody)
      nugList.push(seam._key, ...seam.nuggets)
    }

    // create a lookup of all nuggets written so far
    const writtenNugs = nugList.reduce((acc, cur) => { acc[cur] = 1; return acc }, {})

    // create a markdown chunk for each nugget not already written
    for (const nugget of Object.values(this.allNuggets).filter(n => !(n._key in writtenNugs))) {
      if (!nugget.body) continue
      this.seamNuggetChunks[nugget._key] = nugget.body
    }
  }

  // pull just the markdown from the ordered chunks
  async getSeamNuggetMarkdown () {
    this.populateChunks()
    const chunks = await this.getOrdered()
    return chunks.map(c => c.chunk)
  }

  // pull ordered chunks with model metadata included
  async getSeamNuggetChunks () {
    this.populateChunks()
    return await this.getOrdered()
  }

  #mdForExtract (key, depth) {
    const nug = this.allNuggets[key]
    if (!nug) return undefined // has been filtered out

    let retMd

    if (key in this.seamNuggetChunks) {
      retMd = this.seamNuggetChunks[key]
    } else if (nug._id.startsWith('passage')) {
      if (nug.body) {
        retMd = nug.body
      } else {
        // create a heading when there's no nugget body
        // TODO remove elipses
        retMd = `${'#'.repeat(depth)} ${nug.label}\n`
      }
    }

    if (retMd) {
      // create header if there wasn't one
      if (!retMd.match(NuggetCatalog.HEADING_RE)) {
        return `${'#'.repeat(depth)} ${nug.label}\n\n${retMd}`
      }
      return retMd
    }

    return undefined
  }

  #allowExtract (markdown) {
    return markdown.replace(NuggetCatalog.HEADING_RE, '').length > this.minLength
  }

  // heading depths/levels are taken from the graph depth and overwritten in the output
  // markdown, which ensures the TOC is well ordered
  rewriteHeadings (markdown, depth) {
    const MAX = 6
    depth = (depth > MAX) ? MAX : depth

    const matches = Array.from(markdown.matchAll(NuggetCatalog.HEADING_RE))

    if (matches.length) {
      let last = depth

      // the depth of each heading depends on the number of hashes
      const depths = matches.map(m => m[1].length)

      // create new heading depths based on passed-in depth and other limits
      const newHeads = depths.map(l => l - depths[0] + depth)
        // cannot go over the maximum allowed depth
        .map(l => l > MAX ? MAX : l)
        // do not allow a higher level heading than the first in the page
        .map(l => l < depth ? depth : l)
        // make sure the level only increases by one at a time
        .map(l => {
          const ret = (l > last + 1) ? last + 1 : l
          last = l
          return ret
        })
        // turn the lengths into strings of hashes
        .map(l => '#'.repeat(l))

      // replace the previously matched headings using replacer function
      let idx = 0
      return markdown.replace(NuggetCatalog.HEADING_RE,
        (match, p1, p2) => [newHeads[idx++], p2].join(' '))
    }

    // markdown given to this function must have headers
    // just return it -- might change this to a throw later
    return markdown
  }

  initCheck () {
    if (!this.initialised) {
      throw new Error('must call init() first')
    }
  }

  // get the markdown for the given nugget _key
  getMd (acc, key) {
    // nuggets could be filtered out so just return the accumulator
    if (!(key in this.allNuggets)) return acc

    const parts = [acc]
    parts.push(this.allNuggets[key].body)
    return parts.join('\n')
  }

  // turn '|' separated path strings into a TreeModel, which will allow
  // operations like sorting on the tree later
  async getTree () {
    // TODO dedupe of secondary edges
    const cursor = await this.db.query(aql`
      FOR v, e, p IN 0..10000 OUTBOUND 'passage/adit' GRAPH 'primary'
        PRUNE v.nuggets
        ${join(this.filters)}
        RETURN { keys: CONCAT_SEPARATOR("|", p.vertices[*]._key), nug: LAST(p.vertices[*]) }
    `)

    // these small models are not full nuggets but are enough sort
    const tree = new TreeModel({ modelComparatorFn: Nugget.compare })
    let first = true
    let root

    for await (const c of cursor) {
      if (first) {
        first = false
        root = tree.parse({ key: 'adit', depth: 1, order: 0, label: c.nug.label })
        assert.strictEqual(c.keys, 'adit', 'first vertex should be "adit"')
        continue
      }

      let current = root
      let depth = 1

      // go over keys in path adding any child nodes that do not exist yet
      for (const key of c.keys.split('|')) {
        const node = current.first(n => n.model.key === key)
        if (node) {
          current = node // key already added on prior iteration
        } else {
          current = current.addChild(tree.parse({
            key,
            depth,
            label: c.nug.label,
            order: c.nug.order,
            type: (c.nug._id.startsWith('pass')) ? 'passage' : 'nugget',
            length: (c.nug.body) ? c.nug.body.length : 0
          }))
        }
        depth++
      }
    }
    return root
  }

  getChunk (key, depth) {
    const md = this.#mdForExtract(key, depth)
    if (!md) return
    return this.rewriteHeadings(md, depth)
  }
}
