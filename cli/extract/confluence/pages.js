import remarkParse from 'remark-parse'
import remarkStringify from 'remark-stringify'
import { unified } from 'unified'

import { NuggetCatalog } from '../lib/nugget_catalog.js'

import { Confluence } from './confluence.js'
import { rewriteConfluenceLink } from './rewrite_conf_link.js'
import addPageTitles from './add_page_titles.js'

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

  // page titles are generated from Titles class
  addPageTitles(catalog, root)

  // processNodes takes an array of child node so make a starting node
  const start = [{ parent: confluence.startpageid, node: root }]
  await processNodes(confluence, catalog, start, getPageInfo)

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

  rewriteLinks(confluence, catalog)

  if (argv.lookup) {
    console.log(confluence.getLookup())
  } else {
    await processNodes(confluence, catalog, start, upsertPage)
  }
}

function getPageInfo (confluence, _, nugget, title) {
  // this read-only version populates the Nugget key versus URL lookup
  return confluence.getPageByTitle(title).then(pageData => {
    if (pageData) {
      confluence.addLookupUrl(nugget._key, title) // pageData._links.webui)
    }
    return pageData
  })
}

function upsertPage (confluence, parentId, nugget, title) {
  return confluence.addOrReplacePage(parentId, nugget, title)
}

async function processNodes (confluence, catalog, nodes, processFn) {
  if (nodes.length === 0) return

  // reduce() ensures pages are added in order
  const children = []
  await nodes.reduce((prev, ent) => {
    return prev
      .then(() => {
        const nugget = catalog.fromNode(ent.node)
        if ('page' in nugget) {
          return processFn(confluence, ent.parent, nugget, ent.node.model.title)
        }
      })
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

  await processNodes(confluence, catalog, children, processFn)
}

function rewriteLinks (confluence, catalog) {
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
