import { expect } from 'chai'
import * as td from 'testdouble'
import TreeModel from 'tree-model'

import addPageTitles from '../cli/extract/confluence/add_page_titles.js'
import { NuggetCatalog } from '../cli/extract/lib/nugget_catalog.js'

describe('addPageTitles', () => {
  let rootMock, nodeMock, catalog, tree
  let dbMock

  beforeEach(() => {
    dbMock = td.object(['query'])
    tree = new TreeModel()
    // Mock db.query response if needed using td.when
  })

  beforeEach(() => {
    catalog = new NuggetCatalog(dbMock)
    rootMock = { walk: td.function() }
    nodeMock = { model: {} } // Adjust as needed

    // Define default behavior of fromNode
    // td.when(catalog.fromNode(td.matchers.anything())).thenReturn({ label: 'Page Label', _key: '5c8ea934-0528-4b67-8e10-422c11ba8e11', page: 'foo' })
  })

  it('should set title on nodes with page property', () => {
    // Setup root mock to simulate walking over nodes
    const nodes = [{ model: { title: '' } }, { model: { title: '' } }] // Simulate two nodes
    td.when(rootMock.walk(td.matchers.isA(Function))).thenDo((callback) => {
      nodes.forEach((node) => callback(node))
    })

    // Execute the function under test
    addPageTitles(catalog, rootMock)

    // Verify the title was set on each node
    nodes.forEach((node) => {
      // eslint-disable-next-line no-unused-expressions
      expect(node.model.title).to.be.a('string').and.to.not.be.empty
    })
  })
})
