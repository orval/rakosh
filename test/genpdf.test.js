import { expect } from 'chai'
import * as td from 'testdouble'

describe('generatePdf', function () {
  before(function () {
    this.timeout(5000)
  })

  afterEach(() => td.reset())

  it('renders html then produces pdf with calculated height', async function () {
    // fake NuggetCatalog to avoid DB and heavy init
    class FakeCatalog {
      constructor (db, includes, excludes, withHtml) {
        this.db = db
        this.includes = includes
        this.excludes = excludes
        this.withHtml = withHtml
      }

      async init () { this.initialised = true }
    }
    await td.replaceEsm('../cli/extract/lib/nugget_catalog.js', { NuggetCatalog: FakeCatalog })

    const generateHtml = td.function('generateHtml')
    td.when(generateHtml(td.matchers.anything(), td.matchers.anything(), td.matchers.isA(String), td.matchers.isA(String))).thenResolve('<html>hi</html>')
    await td.replaceEsm('../cli/extract/html/generateHtml.js', { generateHtml })

    const setContentCalls = []
    const pdfCalls = []
    const page = {
      setContent: async (...args) => { setContentCalls.push(args) },
      evaluate: async () => 900,
      pdf: async (opts) => { pdfCalls.push(opts) }
    }
    const browser = {
      newPage: async () => page,
      close: async () => {}
    }
    const puppeteerStub = { launch: async () => browser }
    const puppeteerPath = new URL('../node_modules/puppeteer/lib/esm/puppeteer/puppeteer.js', import.meta.url).pathname
    await td.replaceEsm(puppeteerPath, { __esModule: true, default: puppeteerStub })

    const { generatePdf } = await import('../cli/extract/pdf/genpdf.js')

    const fakeDb = { db: true }
    await generatePdf(fakeDb, { include: ['foo'], exclude: ['bar'], output: '/tmp/out.pdf', verbose: false })

    // HTML set on the page with network idle option
    expect(setContentCalls).to.deep.equal([
      ['<html>hi</html>', { waitUntil: 'networkidle0' }]
    ])

    // PDF rendered with calculated height (evaluate + 100) and expected width/path
    expect(pdfCalls).to.deep.equal([
      {
        path: '/tmp/out.pdf',
        width: '210mm',
        height: '1000px',
        printBackground: true
      }
    ])

    // ensure catalog was built with html flag
    const calls = td.explain(generateHtml).calls
    expect(calls).to.have.length(1)
    const [catalogArg, outputArg] = calls[0].args
    expect(catalogArg).to.be.instanceOf(FakeCatalog)
    expect(catalogArg.withHtml).to.equal(true)
    expect(outputArg).to.equal('/tmp/out.pdf')
  })
})
