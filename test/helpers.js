import { readFileSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'url'

import * as td from 'testdouble'

import { NuggetCatalog } from '../cli/extract/lib/nugget_catalog.js'

async function loadMockNuggets () {
  const data = readFileSync(join(dirname(fileURLToPath(import.meta.url)), 'mock_nuggets.json'), 'utf8')
  return JSON.parse(data)
}

export async function initializeNuggetCatalogWithMock () {
  const dbMock = td.object(['query'])
  const mockNuggets = await loadMockNuggets()

  const cursor = {
    [Symbol.asyncIterator] () {
      let index = 0
      return {
        next () {
          if (index < mockNuggets.length) {
            return Promise.resolve({ done: false, value: mockNuggets[index++] })
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
