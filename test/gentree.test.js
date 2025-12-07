import { expect } from 'chai'
import * as td from 'testdouble'

describe('genTree', function () {
  afterEach(() => td.reset())

  it('builds catalog and calls generateTree when not in debug mode', async function () {
    const root = { walk: () => {} }
    class FakeCatalog {
      constructor (db, include, exclude, withHtml) {
        this.db = db
        this.include = include
        this.exclude = exclude
        this.withHtml = withHtml
      }

      async init () { this.initialised = true }
      async getSeamNuggetTree () { return root }
      fromNode (n) { return n.model || n }
    }

    const generateTree = td.function('generateTree')
    td.when(generateTree(root, td.matchers.isA(FakeCatalog), '/tmp/out')).thenResolve()

    await td.replaceEsm('../cli/extract/lib/nugget_catalog.js', { NuggetCatalog: FakeCatalog })
    await td.replaceEsm('../cli/extract/tree/generateTree.js', { generateTree })

    const { genTree } = await import('../cli/extract/tree/gentree.js')

    const fakeDb = { db: true }
    await genTree(fakeDb, { include: ['i'], exclude: ['e'], directory: '/tmp/out', treedebug: false })

    const explain = td.explain(generateTree)
    expect(explain.callCount).to.equal(1)
    const [rootArg, catalogInstance, dirArg] = explain.calls[0].args
    expect(rootArg).to.equal(root)
    expect(dirArg).to.equal('/tmp/out')
    // catalog was built with HTML flag set to false
    expect(catalogInstance).to.be.instanceOf(FakeCatalog)
    expect(catalogInstance.withHtml).to.equal(false)
    expect(catalogInstance.include).to.deep.equal(['i'])
    expect(catalogInstance.exclude).to.deep.equal(['e'])
    expect(catalogInstance.db).to.equal(fakeDb)
  })

  it('walks tree and skips generateTree in debug mode', async function () {
    const node = {
      model: { label: 'child' },
      getPath: () => [{ model: { label: 'adit' } }, { model: { label: 'child' } }]
    }
    const root = { walk: (cb) => cb(node) }

    class FakeCatalog {
      // eslint-disable-next-line no-useless-constructor
      constructor () {}
      async init () {}
      async getSeamNuggetTree () { return root }
      fromNode (n) { return n.model }
    }

    const generateTree = td.function('generateTree')

    await td.replaceEsm('../cli/extract/lib/nugget_catalog.js', { NuggetCatalog: FakeCatalog })
    await td.replaceEsm('../cli/extract/tree/generateTree.js', { generateTree })

    const logs = []
    const originalLog = console.log
    console.log = (...args) => { logs.push(args) }

    try {
      const { genTree } = await import('../cli/extract/tree/gentree.js')
      await genTree({}, { treedebug: true })
    } finally {
      console.log = originalLog
    }

    expect(td.explain(generateTree).callCount).to.equal(0)
    expect(logs.length).to.equal(1)
    expect(logs[0][0]).to.equal('[child]')
  })
})
