'use strict'
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
  }

  async init () {
    const filters = []
    this.includes.forEach(inc => filters.push(
      aql`FILTER v.${inc.key} == ${inc.value}`
    ))
    this.excludes.forEach(exc => filters.push(
      aql`FILTER v.${exc.key} != ${exc.value}`
    ))

    const cursor = await this.db.query(aql`
      FOR v, e, p IN 0..10000 OUTBOUND "passage/adit" GRAPH "primary"
        OPTIONS { uniqueVertices: "global", order: "weighted" }
        ${join(filters)}
        RETURN v
    `)

    // for now all nuggets are pulled into memory
    for await (const c of cursor) {
      this.allNuggets[c._key] = new Nugget(c)
    }

    this.initialised = true
  }

  // get markdown chunks for seams then any non-seam nuggets
  async getSeamNuggetMarkdown () {
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

    // ordering is determined by this paths query
    const treeRoot = await this.getTree()

    // put the files into the order defined by `paths`
    const orderedChunks = []

    treeRoot.walk((node) => {
      const nug = this.allNuggets[node.model.key]
      if (!nug) return true
      nug.depth = node.model.depth
      const md = this.seamNuggetChunks[nug._key]
      if (this.#canDoExtract(md)) {
        orderedChunks.push(this.rewriteHeadings(md, nug))
      }
      return true
    })

    return orderedChunks
  }

  #canDoExtract (markdown) {
    if (!markdown) return false
    return markdown.replace(NuggetCatalog.HEADING_RE, '').length > this.minLength
  }

  // heading depths/levels are taken from the graph depth and overwritten in the output
  // markdown, which ensures the TOC is well ordered
  rewriteHeadings (markdown, nugget) {
    const MAX = 6
    const depth = (nugget.depth > MAX) ? MAX : nugget.depth

    if (!markdown) {
      // create a heading when there's no nugget body
      return `${'#'.repeat(depth)} ${nugget.label}\n`
    }

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

    // create header if there wasn't one
    return `${'#'.repeat(depth)} ${nugget.label}\n\n${markdown}`
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
    const cursor = await this.db.query(aql`
      FOR v, e, p IN 0..10000 OUTBOUND 'passage/adit' GRAPH 'primary'
        PRUNE v.nuggets
        RETURN CONCAT_SEPARATOR("|", p.vertices[*]._key)
    `)

    const tree = new TreeModel()
    const root = tree.parse({ key: 'adit', depth: 1 })

    for await (const c of cursor) {
      let current = root
      let depth = 1

      // go over keys in path adding any child nodes that do not exist yet
      for (const key of c.split('|')) {
        const node = current.first(n => n.model.key === key)
        if (node) {
          current = node // key already added on prior iteration
        } else {
          current = current.addChild(tree.parse({ key, depth }))
        }
        depth++
      }
    }
    return root
  }
}
