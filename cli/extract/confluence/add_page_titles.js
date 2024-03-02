export default function addPageTitles (catalog, root) {
  const foo = new Map()
  // const labels = {}

  // fill object of paths
  root.walk(n => {
    const nugget = catalog.fromNode(n)
    if ('page' in nugget) {
      const pathArray = n.getPath().map(p => catalog.fromNode(p).label)
      // throw instead   assert.ok(!(pathArray in foo)) // paths must be unique
      foo.set(pathArray, nugget._key)
      // if (nugget.label in labels) console.log('LABEL', nugget._key, nugget.label, this.getTitle(n))// labels[nugget.label])
      // labels[nugget.label] = nugget._key
      n.model.title = getTitle(catalog, n)
    }
  })
}

function getTitle (catalog, node) {
  // const nugget = catalog.fromNode(node)
  // assert.ok('page' in nugget)  throw instead
  const title = node.getPath().map(p => catalog.fromNode(p).label).slice(1).join(' / ')
  if (title === '') return catalog.fromNode(node).label
  return title
}
