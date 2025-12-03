'use strict'
import { writeFileSync, mkdirSync, statSync } from 'node:fs'
import { join } from 'node:path'

import slugify from 'slugify'

export async function generateTree (root, catalog, directory) {
  const start = [{ node: root }]
  await processNodes(catalog, directory, start)
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

function makeMdFile (dir, nugget) {
  let ret = ''
  if (nugget.type === 'passage') {
    ret = nugget.getLabel()
    console.log(`passage ${ret} ${dir}`)
  }

  const markdown = nugget.body
  if (!markdown) {
    return ret
  }
  materializeDir(dir)
  const writeTo = join(dir, nugget.getLabel() + '.md')
  console.log(`writing ${writeTo}`)
  writeFileSync(writeTo, markdown)
  return dir
  // writeFileSync(join(dir, nugget.getLabel() + '.md'), markdown)
}

async function processNodes (catalog, rootDir, nodes) {
  if (nodes.length === 0) return

  // reduce() ensures pages are added in order
  const children = []
  await nodes.reduce((prev, ent) => {
    return prev
      .then(() => {
        const nugget = catalog.fromNode(ent.node)
        if ('page' in nugget) {
          const path = ent.node.getPath().map(p => slugify(catalog.fromNode(p).getLabel())).slice(1).join('/')
          return makeMdFile(join(rootDir, path), nugget)
        }
      })
      .then((dir) => {
        return ent.node
          // find all children of this node
          .all(n => n.parent && n.parent.model._key === ent.node.model._key)
          .map(d => {
            if (dir) {
              children.push({ node: d })
            }
            return d.model._key
          })
      })
  }, Promise.resolve())

  await processNodes(catalog, rootDir, children)
}
