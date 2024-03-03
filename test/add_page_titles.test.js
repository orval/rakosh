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
  })

  function parse (key) {
    return tree.parse(cat.allNuggets[key].document)
  }

  it('should set title on nodes with page property', () => {
    const nodeA = root.addChild(parse('5c8ea934-0528-4b67-8e10-422c11ba8e11'))
    const nodeB = nodeA.addChild(parse('7a9eb935-1234-4b67-8e10-422c11ba8e12'))
    const nodeD = nodeB.addChild(parse('cb0ee6b2-1f85-45ab-a106-3369ddc22920'))
    nodeB.addChild(parse('0bdd94cc-bb6e-4ae0-a585-661032d23365'))
    nodeD.addChild(parse(9838515))

    addPageTitles(cat, root)

    const titles = []

    root.walk((node) => {
      if ('page' in node.model) {
        titles.push(node.model.title)
        // eslint-disable-next-line no-unused-expressions
        expect(node.model.title).to.be.a('string').and.to.not.be.empty
      }
    })

    expect(titles).to.have.members(['A', 'A / B', 'A / B / C'])
  })

  it('should deal with nuggets in multiple places', () => {
    const nodeA = root.addChild(parse('5c8ea934-0528-4b67-8e10-422c11ba8e11'))
    const nodeB = nodeA.addChild(parse('7a9eb935-1234-4b67-8e10-422c11ba8e12'))
    const nodeD = nodeB.addChild(parse('cb0ee6b2-1f85-45ab-a106-3369ddc22920'))
    const nodeC = nodeB.addChild(parse('0bdd94cc-bb6e-4ae0-a585-661032d23365'))
    nodeD.addChild(parse(9838515))
    nodeB.addChild(parse('2cee041b-e28c-484f-80bf-fbcb9d10d859'))
    nodeC.addChild(parse('2cee041b-e28c-484f-80bf-fbcb9d10d859'))

    addPageTitles(cat, root)

    expect(getTitles(root)).to.have.members(['A', 'A / B', 'A / B / C', 'A / B / C / G', 'A / B / G'])
  })

  it('should deal with lots of the same nugget', () => {
    const node1 = root.addChild(parse('5c8ea934-0528-4b67-8e10-422c11ba8e11'))
    const node2 = node1.addChild(parse('5c8ea934-0528-4b67-8e10-422c11ba8e11'))
    const node3 = node2.addChild(parse('5c8ea934-0528-4b67-8e10-422c11ba8e11'))
    node2.addChild(parse('5c8ea934-0528-4b67-8e10-422c11ba8e11'))
    node3.addChild(parse('5c8ea934-0528-4b67-8e10-422c11ba8e11'))

    addPageTitles(cat, root)

    expect(getTitles(root)).to.have.members(['A', 'A / A', 'A / A / A', 'A / A / A', 'A / A / A / A'])
  })

  it('should generate minimal length titles', () => {
    const A___ = root.addChild(parse('5c8ea934-0528-4b67-8e10-422c11ba8e11'))
    const AB__ = A___.addChild(parse('7a9eb935-1234-4b67-8e10-422c11ba8e12'))
    const ABC_ = AB__.addChild(parse('0bdd94cc-bb6e-4ae0-a585-661032d23365'))
    const ABCH = ABC_.addChild(parse('7288ae86-3ef4-467d-881a-2e06cb9f7b0e'))
    const AC__ = A___.addChild(parse('0bdd94cc-bb6e-4ae0-a585-661032d23365'))
    const ACH_ = AC__.addChild(parse('7288ae86-3ef4-467d-881a-2e06cb9f7b0e'))
    const AG__ = A___.addChild(parse('2cee041b-e28c-484f-80bf-fbcb9d10d859'))
    const AGC_ = AG__.addChild(parse('0bdd94cc-bb6e-4ae0-a585-661032d23365'))
    const AGCH = AGC_.addChild(parse('7288ae86-3ef4-467d-881a-2e06cb9f7b0e'))

    expect(ABCH).to.have.property('model')
    expect(AGCH).to.have.property('model')
    expect(ACH_).to.have.property('model')

    addPageTitles(cat, root)

    expect(getTitles(root)).to.have.members([
      'A', 'A / C', 'A / C / H', 'A / B / C / H', 'A / G / C / H', 'A / B', 'A / B / C', 'A / G', 'A / G / C'
    ])
  })

  it('should not double up on the same labels', () => {
    const F___ = root.addChild(parse('bdf03897-78b4-4b97-a838-2ce76f0c3e92'))
    const FG__ = F___.addChild(parse('2cee041b-e28c-484f-80bf-fbcb9d10d859'))
    const FGA_ = FG__.addChild(parse('5c8ea934-0528-4b67-8e10-422c11ba8e11'))
    const FGAA = FGA_.addChild(parse('5c8ea934-0528-4b67-8e10-422c11ba8e11'))

    expect(FGAA).to.have.property('model')

    addPageTitles(cat, root)

    expect(getTitles(root)).to.have.members(['F', 'F / G', 'F / G / A', 'F / G / A / A'])
  })
})

function getTitles (root) {
  const titles = []
  root.walk((node) => {
    if ('page' in node.model) {
      titles.push(node.model.title)
    }
  })
  return titles
}
