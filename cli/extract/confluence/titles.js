export class Titles {
  constructor (catalog, root) {
    this.catalog = catalog
    this.root = root
  }

  getTitle (node) {
    const title = node.getPath().map(p => this.catalog.fromNode(p).label).slice(1).join(' / ')
    if (title === '') return this.catalog.fromNode(node).label
    return title
  }
}
