import { mkdtempSync, mkdirSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

import { expect } from 'chai'
import log from 'loglevel'
import slugify from 'slugify'

import { generateTree } from '../cli/extract/tree/generateTree.js'
import { NuggetCatalog } from '../cli/extract/lib/nugget_catalog.js'
import { FsLayout } from '../cli/lib/fs_layout.js'
import { Nugget } from '../cli/lib/nugget.js'

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

function collectMarkdownWithPaths (dir, base = dir) {
  const files = []

  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name)
    if (entry.isDirectory()) {
      files.push(...collectMarkdownWithPaths(full, base))
    } else if (entry.isFile() && entry.name.endsWith('.md')) {
      files.push({
        path: full.slice(base.length + 1),
        content: readFileSync(full, 'utf8')
      })
    }
  }

  return files
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

function makeStubNode ({ key, label, page, body, type }) {
  const node = {
    model: { _key: key, label, page, body, type },
    parent: null,
    children: []
  }

  node.getPath = function () {
    const path = []
    let current = this
    while (current) {
      path.unshift(current)
      current = current.parent
    }
    return path
  }

  node.all = function (predicate) {
    const matches = []
    const visit = (n) => {
      if (predicate(n)) matches.push(n)
      n.children.forEach(visit)
    }
    visit(this)
    return matches
  }

  return node
}

function makeStubCatalog () {
  return {
    fromNode (node) {
      const model = node.model || {}
      return {
        getLabel: () => model.label || model._key,
        page: model.page,
        body: model.body,
        type: model.type || Nugget.NUGGET
      }
    }
  }
}

describe('generateTree output', function () {
  this.slow(1000)

  before(function () {
    log.setLevel('error')
  })

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
        const trimmed = nugget.page.trim()
        // skip heading-only pages (these are no longer written)
        if (/^#+\s+\S+\s*$/.test(trimmed)) return
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

describe('generateTree seams', function () {
  this.slow(1000)

  before(function () {
    log.setLevel('error')
  })

  it('collates seam nuggets into a single markdown file', async function () {
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

    const seamKey = 'aa91b9a7-d73c-4f77-a4a1-eb1080998105'
    const seamNode = treeRoot.first(n => n.model._key === seamKey)
    expect(seamNode, 'seam node should exist in the tree').to.not.equal(undefined)

    const outDir = mkdtempSync(join(tmpdir(), 'rakosh-tree-'))
    try {
      await generateTree(treeRoot, catalog, outDir)
      const files = collectMarkdownWithPaths(outDir)

      const seamFiles = files.filter(f => f.content.includes('Seam Test'))
      expect(seamFiles.length).to.equal(1)

      const seamFile = seamFiles[0]
      const seamDir = seamFile.path.split('/').slice(0, -1).join('/')
      const seamDirFiles = files.filter(f => f.path.startsWith(seamDir))
      expect(seamDirFiles.map(f => f.path)).to.deep.equal([seamFile.path])

      const childHeadings = [
        'Benefits of SaaS for Small Businesses',
        'Security and Privacy in SaaS',
        'Emerging Trends in SaaS'
      ]

      childHeadings.forEach(head => {
        expect(seamFile.content).to.include(head)
      })
    } finally {
      rmSync(outDir, { recursive: true, force: true })
    }
  })
})

describe('generateTree edge cases', function () {
  it('skips writing when markdown is missing and falls back to slugify when absent from the map', async function () {
    const catalog = makeStubCatalog()
    const phantomRoot = makeStubNode({ key: 'phantom', label: 'Phantom ancestor' })
    const root = makeStubNode({ key: 'root', label: 'Root page', page: '', type: Nugget.PASSAGE })
    root.parent = phantomRoot

    const outDir = mkdtempSync(join(tmpdir(), 'rakosh-tree-'))
    try {
      await generateTree(root, catalog, outDir)
      expect(readdirSync(outDir)).to.deep.equal([])
    } finally {
      rmSync(outDir, { recursive: true, force: true })
    }
  })

  it('throws when an output directory is blocked by an existing file', async function () {
    const catalog = makeStubCatalog()
    const phantomRoot = makeStubNode({ key: 'phantom', label: 'Phantom ancestor' })
    const root = makeStubNode({ key: 'root', label: 'Root page', page: '', type: Nugget.PASSAGE })
    const child = makeStubNode({ key: 'child', label: 'Child page', page: '# child page', type: Nugget.PASSAGE })

    root.parent = phantomRoot
    child.parent = root
    root.children.push(child)

    const outDir = mkdtempSync(join(tmpdir(), 'rakosh-tree-'))
    const conflictPath = join(outDir, slugify(child.model.label))
    writeFileSync(conflictPath, 'not a directory')

    let error
    try {
      await generateTree(root, catalog, outDir)
    } catch (err) {
      error = err
    } finally {
      rmSync(outDir, { recursive: true, force: true })
    }

    expect(error).to.be.an('error')
    expect(error.message).to.match(/not a directory/)
  })

  it('only creates directories for passage nodes when writing files', async function () {
    const catalog = makeStubCatalog()
    const root = makeStubNode({ key: 'root', label: 'Root passage', page: '# root\nroot body', type: Nugget.PASSAGE })
    const passage = makeStubNode({ key: 'passage', label: 'Child Passage', page: '# child\nchild body', type: Nugget.PASSAGE })
    const mid = makeStubNode({ key: 'mid', label: 'Mid Nugget', page: '# mid\nmid body' })
    const leaf = makeStubNode({ key: 'leaf', label: 'Leaf Nugget', page: '# leaf\nleaf body' })

    passage.parent = root
    root.children.push(passage)

    mid.parent = passage
    passage.children.push(mid)

    leaf.parent = mid
    mid.children.push(leaf)

    const outDir = mkdtempSync(join(tmpdir(), 'rakosh-tree-'))
    try {
      await generateTree(root, catalog, outDir)
      const paths = collectMarkdownWithPaths(outDir).map(f => f.path).sort()
      const expected = [
        `${slugify(root.model.label)}.md`,
        `${slugify(passage.model.label)}/${slugify(passage.model.label)}.md`,
        `${slugify(passage.model.label)}/${slugify(mid.model.label)}.md`,
        `${slugify(passage.model.label)}/${slugify(leaf.model.label)}.md`
      ].sort()

      expect(paths).to.deep.equal(expected)
    } finally {
      rmSync(outDir, { recursive: true, force: true })
    }
  })
})
