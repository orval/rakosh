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
})
