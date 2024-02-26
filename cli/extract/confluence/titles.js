export class Titles {
  constructor (root) {
    this.root = root
  }

  getTitle (catalog, node) {
    const title = node.getPath().map(p => catalog.fromNode(p).label).slice(1).join(' / ')
    if (title === '') return catalog.fromNode(node).label
    return title
  }
}
