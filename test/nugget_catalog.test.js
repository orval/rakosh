import { expect } from 'chai'
import * as td from 'testdouble'

import { NuggetCatalog } from '../cli/extract/lib/nugget_catalog.js'

import { initializeNuggetCatalogWithMock } from './helpers.js'

describe('NuggetCatalog class', function () {
  let dbMock

  beforeEach(() => {
    dbMock = td.object(['query'])
    // Mock db.query response if needed using td.when
  })

  it('should correctly initialize with given parameters', function () {
    const includes = [{ key: 'category', value: 'tutorial' }]
    const excludes = [{ key: 'published', value: false }]
    const catalog = new NuggetCatalog(dbMock, includes, excludes, true)

    expect(catalog.filters).to.have.lengthOf(2)
    // eslint-disable-next-line no-unused-expressions
    expect(catalog.withHtml).to.be.true
  })

  it('init fetches data and populates allNuggets', async function () {
    const { catalog } = await initializeNuggetCatalogWithMock()

    expect(catalog.allNuggets).to.have.property('5c8ea934-0528-4b67-8e10-422c11ba8e11')
    // eslint-disable-next-line no-unused-expressions
    expect(catalog.initialised).to.be.true
  })

  it('creates HAS filter when include value is a wildcard', function () {
    const includes = [{ key: 'key1', value: '*' }, { key: 'key2', value: 'foo' }]
    const catalog = new NuggetCatalog(dbMock, includes)

    expect(catalog.filters).to.have.lengthOf(1)
    const { query, bindVars } = catalog.filters[0]
    expect(query).to.include('FILTER HAS(v, @value0)')
    expect(query).to.include('OR v.@value1 == @value2')
    expect(query).to.not.include('v.@value0 ==')
    expect(bindVars).to.include({ value0: 'key1', value1: 'key2', value2: 'foo' })
  })

  it('paginates nuggets into ordered markdown pages', async function () {
    const vertices = [
      { _key: 'adit', label: 'Adit', type: 'passage', fspath: 'adit.md', body: '# Adit' },
      { _key: 'pass1', label: 'Passage One', type: 'passage', passage: 'pass1', fspath: 'pass1.md', body: '# Passage One' },
      { _key: 'nug1', label: 'Nugget One', type: 'nugget', fspath: 'pass1/nug1.md', body: '## Nugget Body' }
    ]
    const paths = ['adit|pass1', 'adit|pass1|nug1']

    // simple FakeDb with path-based responses
    class FakeDb {
      constructor (v, p) { this.vertices = v; this.paths = p }
      async query (q) {
        const queryText = (typeof q === 'string') ? q : (q.query || '')
        if (queryText.includes('RETURN v')) return this.#cursor(this.vertices)
        if (queryText.includes('RETURN { keys')) return this.#cursor(this.paths.map(keys => ({ keys })))
        throw new Error(`Unexpected query: ${queryText}`)
      }

      #cursor (items) {
        return { async * [Symbol.asyncIterator] () { for (const i of items) { yield i } } }
      }
    }

    const db = new FakeDb(vertices, paths)
    const catalog = new NuggetCatalog(db, [], [], true)
    await catalog.init()

    const [pages, refs] = await catalog.getSeamNuggetMarkdown()

    expect(pages).to.have.length(2)
    expect(pages[0]).to.include('# Adit')
    expect(pages[1]).to.include('# Passage One')
    expect(pages[1]).to.include('## Nugget Body')
    expect(refs).to.deep.equal({})
    expect(catalog.embedImages).to.equal(true)
  })

  it('getMdx renders attributes and body content', function () {
    const catalog = new NuggetCatalog({}, [], [], false)

    const nugget = {
      document: { _key: 'n1', type: 'nugget', label: 'Label One', body: '# Heading', paths: ['/foo'] },
      body: '# Heading',
      getBreadcrumbs: () => '<Breadcrumbs />',
      type: 'nugget'
    }
    catalog.allNuggets = { n1: nugget }

    const mdx = catalog.getMdx(nugget, { slug: '/foo' })

    expect(mdx).to.include('<Nugget slug="/foo"')
    expect(mdx).to.include('_key="n1"')
    expect(mdx).to.include('type="nugget"')
    expect(mdx).to.include('paths="/foo"')
    expect(mdx).to.include('<NuggetBody>')
    expect(mdx).to.include('# Heading')
    expect(mdx).to.include('<Breadcrumbs />')
    expect(mdx).to.include('</Nugget>')
  })
})
