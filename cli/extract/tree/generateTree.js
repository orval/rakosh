'use strict'
import { writeFileSync, mkdirSync, statSync } from 'node:fs'
import { join } from 'node:path'

import slugify from 'slugify'

export async function generateTree (root, catalog, directory) {
  const start = [{ node: root }]
  const slugMap = new Map()
  await processNodes(catalog, directory, start, slugMap)
}

function materializeDir (dir) {
  try {
    const dirStat = statSync(dir)
    if (!dirStat.isDirectory()) throw new Error(`${dir} is not a directory`)
  } catch (err) {
    if (err.code === 'ENOENT') {
      mkdirSync(dir, { recursive: true })
    } else {
      throw err
    }
  }
}

function makeMdFile (dir, nugget, slug) {
  let ret = ''
  if (nugget.type === 'passage') {
    ret = slug
  }

  const markdown = ('page' in nugget) ? nugget.page : nugget.body
  if (!markdown) {
    return ret
  }
  materializeDir(dir)
  const writeTo = join(dir, `${slug}.md`)
  // console.log(`writing ${writeTo}`)
  writeFileSync(writeTo, markdown)
  return dir
  // writeFileSync(join(dir, nugget.getLabel() + '.md'), markdown)
}

function getSlug (node, catalog, slugMap) {
  const fromMap = slugMap.get(node.model._key)
  if (fromMap) return fromMap
  return slugify(catalog.fromNode(node).getLabel())
}

async function processNodes (catalog, rootDir, nodes, slugMap) {
  if (nodes.length === 0) return

  const siblingSlugCounts = {}

  // reduce() ensures pages are added in order
  const children = []
  await nodes.reduce((prev, ent) => {
    return prev
      .then(() => {
        const nugget = catalog.fromNode(ent.node)
        const baseSlug = slugify(nugget.getLabel())
        const count = (siblingSlugCounts[baseSlug] || 0) + 1
        siblingSlugCounts[baseSlug] = count
        const slug = (count === 1) ? baseSlug : `${baseSlug}-${count}`
        slugMap.set(ent.node.model._key, slug)

        if ('page' in nugget) {
          const path = ent.node.getPath()
            .map(p => getSlug(p, catalog, slugMap))
            .slice(1)
            .join('/')
          return makeMdFile(join(rootDir, path), nugget, slug)
        }
      })
      .then((dir) => {
        return ent.node
          // find all children of this node
          .all(n => n.parent && n.parent.model._key === ent.node.model._key)
          .map(d => {
            children.push({ node: d })
            return d.model._key
          })
      })
  }, Promise.resolve())

  await processNodes(catalog, rootDir, children, slugMap)
}
