import { expect } from 'chai'
import * as td from 'testdouble'

import { NuggetCatalog } from '../cli/extract/lib/nugget_catalog.js'

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
    const cursor = {
      // Simulate async iteration
      [Symbol.asyncIterator] () {
        let count = 0
        return {
          next () {
            if (count < 1) {
              count++
              return Promise.resolve({
                done: false,
                value: {
                  _key: '5c8ea934-0528-4b67-8e10-422c11ba8e11',
                  fspath: 'path/to/file'
                }
              })
            } else {
              return Promise.resolve({ done: true })
            }
          }
        }
      }
    }

    td.when(dbMock.query(td.matchers.anything())).thenResolve(cursor)

    const catalog = new NuggetCatalog(dbMock)
    await catalog.init()

    expect(catalog.allNuggets).to.have.property('5c8ea934-0528-4b67-8e10-422c11ba8e11')
    // eslint-disable-next-line no-unused-expressions
    expect(catalog.initialised).to.be.true
  })
})
