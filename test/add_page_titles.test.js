import { expect } from 'chai'
// import * as td from 'testdouble'
import TreeModel from 'tree-model'

import addPageTitles from '../cli/extract/confluence/add_page_titles.js'

import { initializeNuggetCatalogWithMock } from './helpers.js'

describe('addPageTitles', () => {
  let cat, tree, root

  beforeEach(async () => {
    const init = await initializeNuggetCatalogWithMock()
    cat = init.catalog

    tree = new TreeModel()
    root = tree.parse({ _key: 'adit', order: 0, label: cat.allNuggets.adit.label })

    const nodeA = root.addChild(tree.parse(cat.allNuggets['5c8ea934-0528-4b67-8e10-422c11ba8e11'].document))
    const nodeB = nodeA.addChild(tree.parse(cat.allNuggets['7a9eb935-1234-4b67-8e10-422c11ba8e12'].document))
    const nodeC = nodeB.addChild(tree.parse(cat.allNuggets['0bdd94cc-bb6e-4ae0-a585-661032d23365'].document))
    const nodeD = nodeB.addChild(tree.parse(cat.allNuggets['cb0ee6b2-1f85-45ab-a106-3369ddc22920'].document))
    const nodeE = nodeD.addChild(tree.parse(cat.allNuggets[9838515].document))
  })

  it('should set title on nodes with page property', () => {
    addPageTitles(cat, root)

    // Verify the title was set on each node
    root.walk((node) => {
      if ('page' in node.model) {
        // eslint-disable-next-line no-unused-expressions
        expect(node.model.title).to.be.a('string').and.to.not.be.empty
      }
    })
  })
})
