import { mkdtempSync, readdirSync, readFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

import { expect } from 'chai'
import slugify from 'slugify'

import { generateTree } from '../cli/extract/tree/generateTree.js'
import { NuggetCatalog } from '../cli/extract/lib/nugget_catalog.js'
import { FsLayout } from '../cli/lib/fs_layout.js'

class FakeDb {
  constructor (vertices, paths) {
    this.vertices = vertices
    this.paths = paths
  }

  async query (q) {
    const queryText = (typeof q === 'string') ? q : (q.query || '')

    if (queryText.includes('RETURN v')) {
      return this.#cursor(this.vertices)
    }

    if (queryText.includes('RETURN { keys')) {
      return this.#cursor(this.paths.map(keys => ({ keys })))
    }

    throw new Error(`Unexpected query: ${queryText}`)
  }

  #cursor (items) {
    return {
      async * [Symbol.asyncIterator] () {
        for (const item of items) {
          yield item
        }
      }
    }
  }
}

function normalize (text) {
  return text.replace(/#+\s*/g, '').replace(/\s+/g, ' ').trim()
}

function collectMarkdown (dir) {
  const contents = []

  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name)
    if (entry.isDirectory()) {
      contents.push(...collectMarkdown(full))
    } else if (entry.isFile() && entry.name.endsWith('.md')) {
      contents.push(readFileSync(full, 'utf8'))
    }
  }

  return contents
}

function ensureKeys (root) {
  root.walk(node => {
    if (!node.model._key) {
      const labels = node.getPath().map(n => n.model.label || n.model.passage || n.model._key || 'node')
      const fallback = slugify(labels.join('-'), { lower: true, strict: true })
      node.model._key = fallback || `auto-${labels.join('-')}`
    }
  })
}

describe('generateTree output', function () {
  it('contains all markdown bodies from the source fsLayout', async function () {
    const repoRoot = join(dirname(fileURLToPath(import.meta.url)), '..')
    const fixtureDir = join(repoRoot, 'examples', 'my-mine')
    const fsLayout = new FsLayout(fixtureDir)

    ensureKeys(fsLayout.root)

    const vertices = []
    const paths = []

    fsLayout.root.walk(node => {
      const model = Object.assign({}, node.model)
      delete model.children
      vertices.push(model)
      paths.push(node.getPath().map(n => n.model._key).join('|'))
    })

    const db = new FakeDb(vertices, paths)
    const catalog = new NuggetCatalog(db)
    await catalog.init()
    const treeRoot = await catalog.getSeamNuggetTree()

    const expectedPages = []
    treeRoot.walk(node => {
      const nugget = catalog.fromNode(node)
      if ('page' in nugget) {
        expectedPages.push(normalize(nugget.page))
      }
    })

    const outDir = mkdtempSync(join(tmpdir(), 'rakosh-tree-'))
    try {
      await generateTree(treeRoot, catalog, outDir)

      const generated = collectMarkdown(outDir).map(normalize).join(' ')
      expectedPages.forEach(body => {
        expect(generated).to.contain(body)
      })
    } finally {
      rmSync(outDir, { recursive: true, force: true })
    }
  })
})
