const { Nugget } = require('../../lib/nugget')

exports.MineMap = class MineMap {
  constructor () {
    this.minemap = {}
  }

  addVerticies (vertices) {
    let maplevel = this.minemap

    // a long concatenated ID is used so that the React components have unique keys
    let longId = ''

    vertices.forEach(vertex => {
      const nug = new Nugget(vertex, vertex.body)
      longId = longId + '|' + nug._id
      if (!(longId in maplevel)) {
        maplevel[longId] = {
          vid: nug._id,
          name: nug.label,
          type: nug.type,
          seam: ('nuggets' in nug),
          children: {}
        }
      }
      maplevel = maplevel[longId].children
    })
  }

  // convert from dictionary-based format to array-based to match the format required by react-arborist
  #convert (maplevel) {
    const arr = []
    for (const [k, v] of Object.entries(maplevel)) {
      v.id = k
      v.children = this.#convert(v.children)
      if (v.children.length === 0) delete v.children
      arr.push(v)
    }
    return arr
  }

  // remove nuggets from a passage when they exist in a seam in that passage
  #dedupe () {
    function seamNuggets (level, id) {
      const vertex = level[id]
      const nugs = []
      if (vertex.type === 'nugget' && !vertex.seam) nugs.push(vertex.vid)
      for (const [longId, val] of Object.entries(vertex.children)) {
        if (val.type === 'nugget' && !vertex.seam) nugs.push(val.vid)
        nugs.push(...seamNuggets(vertex.children, longId))
      }
      return nugs
    }

    // this is a mess
    function dedupeLevel (level) {
      const seams = []
      for (const [id, val] of Object.entries(level)) {
        if (val.seam) seams.push(id)
      }
      const vidsToRemove = []
      for (const id of seams) {
        vidsToRemove.push(...seamNuggets(level, id))
      }
      const uniqueVids = {}
      for (const r of vidsToRemove) uniqueVids[r] = 1
      for (const [id, val] of Object.entries(level)) {
        if (val.vid in uniqueVids) {
          delete level[id] // deleting from within iteration is janky
        }
      }
      for (const val of Object.values(level)) {
        dedupeLevel(val.children)
      }
      return level
    }

    return dedupeLevel(this.minemap)
  }

  // do not show the nuggets that make up a seam
  #seamsOnly (level) {
    for (const vertex of Object.values(level)) {
      if (vertex.seam) vertex.children = {}
      else this.#seamsOnly(vertex.children)
    }
    return level
  }

  #getOpenStates (maplevel) {
    const openStates = {}

    function getOpenStatesLevel (level, isOpen) {
      for (const [id, vertex] of Object.entries(level)) {
        if (vertex.seam) isOpen = false
        openStates[id] = isOpen
        getOpenStatesLevel(vertex.children, isOpen)
      }
    }

    getOpenStatesLevel(maplevel, true)
    return openStates
  }

  // various actions are carried out to flatten out the graph of vertices into a tree view
  toTree (seamsOnly = false) {
    // remove any nuggets that are duplicated
    let deduped = this.#dedupe()

    // optionally remove any children of seams
    if (seamsOnly) deduped = this.#seamsOnly(deduped)

    // determine which tree nodes are initially open or closed
    const initialOpenState = this.#getOpenStates(deduped)

    // convert objects-in-objects to the array based structure React Arborist needs
    const initialData = this.#convert(deduped)

    return JSON.stringify({ initialData, initialOpenState }, null, 2)
  }
}
