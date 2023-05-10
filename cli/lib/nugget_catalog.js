'use strict'
const { aql, join } = require('arangojs/aql')
const { Nugget } = require('./nugget')

exports.NuggetCatalog = class NuggetCatalog {
  constructor (db, includes = [], excludes = []) {
    this.db = db
    this.includes = includes
    this.excludes = excludes
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
    const paths = await this.getPaths()

    // put the files into the order defined by `paths`
    const orderedChunks = []
    paths.forEach(p => orderedChunks.push(this.seamNuggetChunks[p.split('|').pop()]))

    return orderedChunks
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

  async getPaths () {
    const cursor = await this.db.query(aql`
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
      if (c.split('|').pop() in this.seamNuggetChunks) paths.push(c)
    }
    return paths
  }
}
