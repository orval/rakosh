export default function addPageTitles (catalog, root) {
  let sliceSize = 1
  let untitledPageCount

  do {
    const ptMap = new PageTitlesMap()

    // walk the tree adding candidate titles to the PageTitlesMap
    root.walk(node => {
      const nugget = catalog.fromNode(node)
      if (node.model._key === 'adit') ptMap.add(node.model.label, node)

      if ('page' in nugget && !('title' in node.model)) {
        const labelPath = node.getPath().map(p => catalog.fromNode(p).label).slice(1)
        if (labelPath.length === 0) return

        // let last sliceSize elements of path
        const candidateTitle = labelPath.slice(-sliceSize).join(' | ')
        ptMap.add(candidateTitle, node)
      }
    })

    // add titles for each page that has a single candidate title
    ptMap.setUniqueTitles()

    const lastCount = untitledPageCount
    untitledPageCount = countUntitledPages(root)

    // when there are no more unique titles set remaining with duplicates
    if (lastCount === untitledPageCount) {
      ptMap.setTitles()
      break
    }

    sliceSize++
  } while (untitledPageCount > 0)
}

function countUntitledPages (root) {
  return root.all(n => 'page' in n.model && !('title' in n.model)).length
}

class PageTitlesMap {
  constructor () {
    this.map = new Map()
  }

  add (label, node) {
    if (!this.map.has(label)) {
      this.map.set(label, [])
    }
    const nodes = this.map.get(label)
    if (!nodes.includes(node)) {
      nodes.push(node)
    }
  }

  setUniqueTitles () {
    this.map.forEach((nodes, label) => {
      if (nodes.length === 1) {
        nodes[0].model.title = label
      }
    })
  }

  setTitles () {
    this.map.forEach((nodes, label) => {
      nodes.forEach((node) => { node.model.title = label })
    })
  }
}
