import * as td from 'testdouble'

import { NuggetCatalog } from '../cli/extract/lib/nugget_catalog.js'

export async function initializeNuggetCatalogWithMock () {
  const dbMock = td.object(['query'])
  const cursor = {
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

  return { catalog, dbMock }
}
