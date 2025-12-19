'use strict'
import { writeFileSync, mkdirSync, statSync, existsSync } from 'node:fs'
import { join } from 'node:path'

import log from 'loglevel'
import slugify from 'slugify'

import { Nugget } from '../../lib/nugget.js'

export async function generateTree (root, catalog, directory) {
  const start = [{ node: root }]
  const slugMap = new Map()
  await processNodes(catalog, directory, start, slugMap)
}

function materializeDir (dir) {
  try {
    const dirStat = statSync(dir)
    if (!dirStat.isDirectory()) throw new Error(`${dir} is not a directory`)
    log.info(`found directory ${dir}`)
  } catch (err) {
    if (err.code === 'ENOENT') {
      mkdirSync(dir, { recursive: true })
      log.info(`created directory ${dir}`)
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

  // skip content that only has a bare heading
  const trimmed = markdown.trim()
  if (/^#+\s+\S+\s*$/.test(trimmed)) {
    return ret
  }

  const normalised = normaliseHeadings(trimmed)

  materializeDir(dir)
  const writeTo = join(dir, `${slug}.md`)
  if (existsSync(writeTo)) {
    log.warn(`overwriting existing markdown file ${writeTo}`)
  }
  log.info(`writing markdown file ${writeTo}`)
  writeFileSync(writeTo, normalised)
  return dir
}

function getSlug (node, catalog, slugMap) {
  const fromMap = slugMap.get(node.model._key)
  if (fromMap) return fromMap
  return slugify(catalog.fromNode(node).getLabel())
}

async function processNodes (catalog, rootDir, nodes, slugMap) {
  if (nodes.length === 0) return

  // reduce() ensures pages are added in order
  const children = []
  await nodes.reduce((prev, ent) => {
    return prev
      .then(() => {
        const nugget = catalog.fromNode(ent.node)
        const slug = slugify(nugget.getLabel())
        slugMap.set(ent.node.model._key, slug)

        if ('page' in nugget) {
          const path = ent.node.getPath()
            .filter(p => catalog.fromNode(p).type === Nugget.PASSAGE)
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

// reduce all headings so the minimum level becomes H1
function normaliseHeadings (markdown) {
  const lines = markdown.split('\n')
  const depths = lines
    .map(l => l.match(/^(#{1,6})\s+/))
    .filter(Boolean)
    .map(m => m[1].length)

  if (depths.length === 0) return markdown

  const shift = Math.min(...depths) - 1
  let nuggetIndex = 0

  return lines.map(line => {
    const m = line.match(/^(#{1,6})\s+(.*)/)
    if (!m) return line
    const base = Math.max(1, m[1].length - (shift > 0 ? shift : 0))
    if (base === 1) nuggetIndex += 1
    const bump = (nuggetIndex > 1) ? 1 : 0
    const level = Math.min(6, base + bump)
    return `${'#'.repeat(level)} ${m[2]}`
  }).join('\n')
}
