import remarkParse from 'remark-parse'
import remarkStringify from 'remark-stringify'
import { unified } from 'unified'

import { NuggetCatalog } from '../lib/nugget_catalog.js'

import { rewriteConfluenceLink } from './rewrite_conf_link.js'
import { Confluence } from './confluence.js'

function getTitle (catalog, node) {
  const title = node.getPath().map(p => catalog.fromNode(p).label).slice(1).join(' / ')
  if (title === '') return catalog.fromNode(node).label
  return title
}

export async function confluencePages (db, argv) {
  const confluence = new Confluence(argv)
  await confluence.init()

  if (argv['delete-all-under-start-page-id']) {
    await confluence.deleteAllUnderStartPageId()
    return
  }

  const catalog = new NuggetCatalog(db, argv.include, argv.exclude)
  await catalog.init()

  const root = await catalog.getSeamNuggetTree()

  // append confluence children macro to pages with children
  for (const nug of Object.values(catalog.allNuggets)) {
    if ('page' in nug) nug.page += '\n---\n\n{children}'
  }

  // hidden option for just printing the tree
  if (argv.treedebug) {
    root.walk((n) => {
      const nugget = catalog.fromNode(n)
      const path = n.getPath().map(p => catalog.fromNode(p).label).slice(1).join('|')
      console.log(`[${path}]`, nugget)
    })
    return
  }

  function getPageInfo (catalog, _, node) {
    // this read-only version populates the Nugget key versus URL lookup
    const nugget = catalog.fromNode(node)
    const title = getTitle(catalog, node)
    return confluence.getPageByTitle(title).then(pageData => {
      if (pageData) {
        confluence.addLookupUrl(nugget._key, title) // pageData._links.webui)
      }
      return pageData
    })
  }

  function doPage (catalog, parentId, node) {
    const nugget = catalog.fromNode(node)
    const title = getTitle(catalog, node)
    return confluence.addOrReplacePage(parentId, nugget, title)
  }

  async function processNodes (catalog, nodes, processFn) {
    if (nodes.length === 0) return

    // reduce() ensures pages are added in order
    const children = []
    await nodes.reduce((prev, ent) => {
      return prev
        .then(() => processFn(catalog, ent.parent, ent.node))
        .then((pageData) => {
          return ent.node
            // find all children of this node
            .all(n => n.parent && n.parent.model._key === ent.node.model._key)
            .map(d => {
              if (pageData) {
                children.push({ parent: pageData.id, node: d })
              }
              return d.model._key
            })
        })
    }, Promise.resolve())

    await processNodes(catalog, children, processFn)
  }

  const start = [{ parent: confluence.startpageid, node: root }]
  await processNodes(catalog, start, getPageInfo)

  // generate URLs for non-page nuggets
  root.walk((n) => {
    const nugget = catalog.fromNode(n)
    if (!confluence.inLookup(nugget._key) && Object.keys(nugget.pageRefs).length > 0) {
      for (const pageKey of Object.keys(nugget.pageRefs)) {
        const url = confluence.getLookupUrl(pageKey)
        if (url) confluence.addLookupUrl(nugget._key, `${url}#${nugget.label}`)
      }
    }
  })

  rewriteLinks(catalog, confluence)

  if (argv.lookup) {
    console.log(confluence.getLookup())
  } else {
    await processNodes(catalog, start, doPage)
  }
}

function rewriteLinks (catalog, confluence) {
  for (const nug of Object.values(catalog.allNuggets)) {
    if ('page' in nug) {
      const parsedPage = unified()
        .use(remarkParse)
        .use(rewriteConfluenceLink, { conf: confluence })
        .use(remarkStringify, { resourceLink: true, rule: '-' })
        .processSync(nug.page).toString().trim()

      nug.page = parsedPage
    }
  }
}
