'use strict'
import assert from 'assert'
import { format } from 'node:util'

import { aql, join } from 'arangojs/aql.js'
import markdownlint from 'markdownlint'
import remarkDirective from 'remark-directive'
import remarkParse from 'remark-parse'
import remarkStringify from 'remark-stringify'
import slugify from 'slugify'
import TreeModel from 'tree-model'
import truncateMarkdown from 'markdown-truncate'
import { unified } from 'unified'

import { Nugget } from '../../lib/nugget.js'

import directiveToReactAdmon from './admonition.js'
import rewriteGatsbyLink from './rewrite_gatsby_link.js'
import rewriteImageLink from './rewrite_image_link.js'
import rewriteLink from './rewrite_link.js'

export class NuggetCatalog {
  static HEADING_RE = /^(#+)\s+(.+)$/gm

  constructor (db, includes = [], excludes = [], withHtml = false) {
    this.db = db
    this.allNuggets = {}
    this.initialised = false
    this.slugLookup = {}
    this.withHtml = withHtml
    this.embedImages = false

    this.filters = []

    if (includes.length > 0) {
      this.filters.push(join(
        includes.map((i, index) => (index === 0)
          ? aql`FILTER v.${i.key} == ${i.value}`
          : aql`v.${i.key} == ${i.value}`)
        , ' OR '))
    }

    if (excludes.length > 0) {
      this.filters.push(join(
        excludes.map((e, index) => (index === 0)
          ? aql`FILTER v.${e.key} != ${e.value}`
          : aql`v.${e.key} != ${e.value}`)
        , ' AND '))
    }
  }

  // return the aql-joined filters
  getFilters () {
    return join(this.filters)
  }

  // get a nugget using a TreeModel node
  fromNode (node) {
    assert.ok(node.model)
    const nugget = this.allNuggets[node.model._key]
    assert.ok(nugget)
    return nugget
  }

  hasChildren (node) {
    if (node.hasChildren()) {
      for (const child of node.children.map(n => this.fromNode(n))) {
        if (child.isHidden()) continue
        return true
      }
    }
    return false
  }

  async init () {
    const cursor = await this.db.query(aql`
      FOR v, e, p IN 0..10000 OUTBOUND "passage/adit" GRAPH "primary"
        OPTIONS { uniqueVertices: "global", order: "weighted" }
        RETURN v
    `)

    // for now all nuggets are pulled into memory
    for await (const c of cursor) {
      this.allNuggets[c._key] = new Nugget(c)
    }

    this.initialised = true
  }

  // link a nugget to its parent by appending to the parent's page
  appendToPage (parentKey, childKey) {
    const parent = this.allNuggets[parentKey]
    const child = this.allNuggets[childKey]

    if (child.isHidden() || parent.pageKeys.includes(childKey)) return

    parent.pageKeys.push(childKey)
    child.addPageRef(parentKey)
  }

  // get an ordered array of markdown pages with metadata
  async #getPaginated () {
    // ordering is determined by walking the tree
    const treeRoot = await this.#getPaginatedTree()

    // put the files into the order defined by the tree
    const orderedPages = []

    treeRoot.walk((node) => {
      const nugget = this.fromNode(node)
      if ('page' in nugget) orderedPages.push(nugget.page)
      return true
    })

    // gather all processed refs
    const refs = {}
    treeRoot.walk((node) => {
      const nugget = this.fromNode(node)
      Object.assign(refs, nugget.refs)
    })

    return [orderedPages, refs]
  }

  // collate markdown chunks into pages based on passage
  async #getPaginatedTree () {
    const treeRoot = await this.#getTree()

    // collate nuggets up to seams to make page
    treeRoot.walk((node) => {
      const seam = this.fromNode(node)
      if (seam.nuggets) {
        this.appendToPage(seam._key, seam._key)
        seam.nuggets.forEach(n => this.appendToPage(seam._key, n))

        // record in each nugget that they are part of a page
        seam.nuggets.forEach(n => {
          Object.assign(seam.refs, this.allNuggets[n].refs)
        })
      }
    })

    // collate nuggets up to their passage to make pages
    treeRoot.walk((node) => {
      const nugget = this.fromNode(node)
      if (node.parent) {
        const parentNugget = this.fromNode(node.parent)

        // nuggets within a non-seam passage are placed in the passage's page
        if (parentNugget.type === Nugget.PASSAGE &&
           !parentNugget.nuggets &&
            nugget.type === Nugget.NUGGET &&
            Object.keys(nugget.pageRefs).length === 0 &&
            !nugget.isHidden()) {
          this.appendToPage(parentNugget._key, parentNugget._key) // ensure self is in the page
          this.appendToPage(parentNugget._key, nugget._key)
        }

        // always push refs
        Object.assign(parentNugget.refs, nugget.refs)
      }
    })

    // create pages for nuggets not already collated
    treeRoot.walk((node) => {
      const nugget = this.fromNode(node)

      // empty passage leaf nodes are skipped
      if (!nugget.body && !this.hasChildren(node) && nugget.type === Nugget.PASSAGE) {
        return true
      }

      if (nugget.pageKeys.length === 0 && Object.keys(nugget.pageRefs).length === 0) {
        this.appendToPage(nugget._key, nugget._key)
      }
    })

    // generate page markdown
    treeRoot.walk((node) => {
      const nugget = this.fromNode(node)

      if (typeof nugget.pageKeys === 'object' && nugget.pageKeys.length > 0) {
        const accumulatedNuggets = nugget.pageKeys.reduce((acc, key) => this.#getMd(acc, key), '')
        if (accumulatedNuggets.trim() === '') return true

        const depth = node.getPath().length - 1 // top level after adit is H1
        nugget.page = this.#rewriteHeadings(this.#processMarkdown(accumulatedNuggets, nugget._key), depth)
      }
    })

    return treeRoot
  }

  // pull just the markdown from the ordered pages
  async getSeamNuggetMarkdown () {
    this.embedImages = true // PDF and HTML use embedded images
    return await this.#getPaginated()
  }

  // pull ordered pages with model metadata included
  async getSeamNuggetTree () {
    return await this.#getPaginatedTree()
  }

  // heading depths/levels are taken from the graph depth and overwritten in the output
  // markdown, which ensures the TOC is well ordered
  #rewriteHeadings (markdown, depth) {
    const MAX = 6
    depth = (depth > MAX) ? MAX : depth
    depth = (depth < 1) ? 1 : depth

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
  #getMd (acc, key) {
    // nuggets could be filtered out so just return the accumulator
    if (!(key in this.allNuggets)) return acc
    const nugget = this.allNuggets[key]

    // passages can have an empty body so insert a heading label
    const body = ('body' in nugget) ? nugget.body : `# ${nugget.label}\n`

    const parts = [acc]
    if (this.withHtml) parts.push(`\n<div id="${key}">\n`)

    parts.push(body)
    if (this.withHtml) parts.push('\n</div>\n')

    return parts.join('\n')
  }

  // turn '|' separated path strings into a TreeModel, which will allow
  // operations like sorting on the tree later
  async #getTree () {
    // TODO dedupe of secondary edges
    const cursor = await this.db.query(aql`
      FOR v, e, p IN 0..10000 OUTBOUND 'passage/adit' GRAPH 'primary'
        ${this.getFilters()}
        RETURN { keys: CONCAT_SEPARATOR("|", p.vertices[*]._key), nug: LAST(p.vertices[*]) }
    `)

    // TreeModel will sort in the same way as a Nugget list
    const tree = new TreeModel({ modelComparatorFn: Nugget.compare })
    const root = tree.parse({ _key: 'adit', order: 0, label: this.allNuggets.adit.label })

    for await (const c of cursor) {
      let current = root

      // go over keys in path adding any child nodes that do not exist yet
      for (const key of c.keys.split('|')) {
        const node = current.first(n => n.model._key === key)
        if (node) {
          current = node // key already added on prior iteration
        } else {
          const nugget = this.allNuggets[key]
          assert.ok(nugget)
          current = current.addChild(tree.parse({
            _key: nugget._key,
            label: nugget.label,
            order: nugget.order
          }))
        }
      }
    }

    // hide empty passages with no children or all children hidden
    root.walk(n => {
      const nugget = this.fromNode(n)
      if (!nugget.body && !this.hasChildren(n) && nugget.type === Nugget.PASSAGE) {
        nugget.hide()
      }
    })

    return root
  }

  // generate breadcrumb data for each nugget in the catalog
  async #generateBreadcrumbs (treeRoot) {
    this.slugLookup = {}
    const promises = []

    treeRoot.walk(node => {
      const nugget = this.fromNode(node)

      // query the paths from the given vertex back to the adit
      promises.push(this.db.query(aql`
        FOR v, e, p IN 1..100 INBOUND ${nugget._id} GRAPH 'primary'
        OPTIONS { order: "weighted", weightAttribute: "weight" }
        FILTER v._id == 'passage/adit'
        RETURN REVERSE(
          FOR vertex IN p.vertices[*]
          RETURN { _id: vertex._id, label: vertex.label, shortlabel: vertex.shortlabel, _key: vertex._key }
        )
      `)
        .then(cursor => {
          const breadcrumbs = []
          const paths = []

          cursor.forEach(c => {
            // generate URL path for this nugget using slugified labels
            paths.push('/' + c.filter(b => b._id !== 'passage/adit')
              .map(b => slugify(b.shortlabel || b.label).toLowerCase())
              .join('/')
            )

            // filter out the adit and self then push non-zero length paths into list
            const crumb = c.filter(b => b._id !== 'passage/adit' && b._id !== nugget._id)
              .map(({ _id, ...rest }) => rest)

            if (crumb.length > 0) breadcrumbs.push(crumb)
          }).then(() => {
            nugget.breadcrumbs = breadcrumbs
            nugget.paths = paths

            // have paths and keys map to the primary slug
            if (paths.length > 1) {
              paths.slice(1).forEach(e => { this.slugLookup[e] = paths[0] })
            }
            if (paths.length > 0) {
              this.slugLookup['/' + nugget._key] = paths[0]
            }
          })
        })
        .catch(error => {
          console.error(error)
          throw error
        })
      )
    })

    await Promise.all(promises)
  }

  // markdown is parsed into an AST so that markdown directives can be replaced
  // with JSX for react-admonitions, then compiled back into markdown
  #processMarkdown (markdown, key, gatsby = false) {
    const processor = unified()
      .use(remarkParse)
      .use(remarkDirective)
      .use(rewriteImageLink, { allNuggets: this.allNuggets, key, embed: this.embedImages })
      .use(directiveToReactAdmon)

    if (gatsby) {
      processor.use(rewriteGatsbyLink, { allNuggets: this.allNuggets, key })
    } else {
      processor.use(rewriteLink, { allNuggets: this.allNuggets })
    }

    processor.use(remarkStringify, { resourceLink: true })
    return processor.processSync(markdown).toString()
  }

  // generate an MDX component named after the type
  getMdx (nugget, additions = {}, append = '') {
    const component = ('nuggets' in nugget) ? 'Seam' : nugget.type.charAt(0).toUpperCase() + nugget.type.slice(1)
    const entries = Object.assign(additions, nugget.document)
    delete entries.body
    delete entries.breadcrumbs
    delete entries.pageKeys
    delete entries.pageRefs

    if (!entries.slug) {
      entries.slug = (entries.paths.length > 0) ? entries.paths[0] : '/'
    }

    const hLevel = (entries.direction || entries.inseam) ? 2 : 1

    // it is decreed that breadcrumbs are not required in outbound vertices
    const breadcrumbs = (entries.direction === 'outbound' || entries.inseam)
      ? ''
      : nugget.getBreadcrumbs()

    const body = getBody(entries, nugget)

    const mostOfTheMdx = format(
      '<%s %s>\n<NuggetBody>\n%s\n</NuggetBody>\n%s\n%s',
      component,
      Object.keys(entries).map(a => `${a}="${entries[a]}"`).join(' '),
      this.#rewriteHeadings(this.#processMarkdown(body, entries._key, true), hLevel),
      breadcrumbs,
      append
    )

    // mostly pointless tidying up of the MDX
    return format('%s\n</%s>\n', mostOfTheMdx.trimEnd(), component)
  }

  // generate MDX pages and a lookup table of slugs/paths
  async getAllMdx () {
    const treeRoot = await this.#getTree()
    await this.#generateBreadcrumbs(treeRoot)

    function notInTree (key) {
      const node = treeRoot.first(n => { return n.model._key === key })
      return (typeof node === 'undefined')
    }

    const mdxNuggets = []
    const promises = []

    treeRoot.walk(async (node) => {
      const promise = (async () => {
        const nugget = this.fromNode(node)

        // get all adjacent vertices for each nugget and write them to the page
        const cursor = await this.db.query(aql`
          FOR v, e IN 1..1 ANY ${nugget._id} GRAPH 'primary'
          RETURN { v, e }
        `)
        // RETURN { from: e._from, to: e._to }

        const nuggetsOutbound = []
        const passagesOutbound = []
        const nuggetsInbound = []
        const passagesInbound = []

        const processAdjacent = (id, isOutbound) => {
          const [type, key] = id.split('/')
          const nug = this.allNuggets[key]

          // ignore the vertex if it is not in the tree
          if (notInTree(key)) return

          // skip if it is a hidden nugget
          if (nug.isHidden()) return

          if (type === Nugget.PASSAGE) {
            isOutbound ? passagesOutbound.push(nug) : passagesInbound.push(nug)
          } else {
            isOutbound ? nuggetsOutbound.push(nug) : nuggetsInbound.push(nug)
          }
        }

        for await (const c of cursor) {
          if (c.e._from === nugget._id) {
            processAdjacent(c.e._to, true)
          } else if (c.e._to === nugget._id) {
            processAdjacent(c.e._from, false)
          }
        }

        nuggetsOutbound.sort(Nugget.compare)
        passagesOutbound.sort(Nugget.compare)
        nuggetsInbound.sort(Nugget.compare)
        passagesInbound.sort(Nugget.compare)

        // collect up Nugget MDX to append to Seam component
        let append = ''
        if ('nuggets' in nugget) {
          append = nugget.nuggets
            .filter(n => !notInTree(n))
            .map(n => this.getMdx(this.allNuggets[n], { inseam: true }))
            .join('\n')
        }

        const slug = (nugget.paths.length > 0) ? nugget.paths[0] : '/'

        const mdx = [
          nugget.getFrontMatter({ slug }),
          '<NuggetArea>',
          this.getMdx(nugget, { slug }, append),
          '<NuggetsInbound>',
          ...nuggetsInbound.map(v => this.getMdx(v, { direction: 'inbound' })),
          '</NuggetsInbound>',
          '<NuggetsOutbound>',
          ...nuggetsOutbound.map(v => this.getMdx(v, { direction: 'outbound' })),
          '</NuggetsOutbound>',
          '</NuggetArea>',
          '<PassagesInbound>',
          ...passagesInbound.map(v => this.getMdx(v, { direction: 'inbound' })),
          '</PassagesInbound>',
          '<PassagesOutbound>',
          ...passagesOutbound.map(v => this.getMdx(v, { direction: 'outbound' })),
          '</PassagesOutbound>'
        ]

        mdxNuggets.push([nugget, mdx.join('\n')])
      })()

      promises.push(promise)
    })

    await Promise.all(promises)
    return mdxNuggets
  }

  async getAllNuggets () {
    const treeRoot = await this.#getTree()
    await this.#generateBreadcrumbs(treeRoot)

    const slugs = []
    const promises = []

    treeRoot.walk(async (node) => {
      const promise = (async () => {
        const nugget = this.fromNode(node)
        const slug = (nugget.paths?.length > 0) ? nugget.paths[0] : '/'
        if (!slugs.some(([_, s]) => s === slug)) {
          slugs.push([nugget, slug])
        }
      })()

      promises.push(promise)
    })

    await Promise.all(promises)
    return slugs
  }

  // keep truncating markdown until it's valid
  static truncateMd (markdown, len = 100) {
    let numErrors = 1
    let truncationLength = len

    do {
      const truncated = truncateMarkdown(markdown, {
        limit: truncationLength,
        ellipsis: true
      })

      const errors = markdownlint.sync({
        strings: { truncated },
        config: {
          'line-length': false,
          'first-line-heading': false,
          MD047: false
        }
      })

      numErrors = errors.truncated.length
      if (numErrors === 0) return truncated

      truncationLength--
    } while (numErrors > 0 && truncationLength > 0)

    throw new Error('Not able to truncate markdown: ' + markdown)
  }
}

function getBody (entries, nugget) {
  if ('__media' in entries) {
    // for now media nuggets are represented by a markdown image link
    return `![${entries.label}](${entries._key})`
  }

  if ('body' in nugget) {
    // truncate markdown in inbound/outbound nuggets to save space
    return entries.direction ? NuggetCatalog.truncateMd(nugget.body) : nugget.body
  }

  // fall back to just the label as a heading
  return '### ' + nugget.label
}
