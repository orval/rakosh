const { Nugget } = require('../../../lib/nugget')

exports.MineMap = class MineMap {
  constructor () {
    this.minemap = {}
  }

  addVerticies (vertices) {
    let maplevel = this.minemap

    // a long concatenated ID is used so that the React components have unique keys
    let longId = ''
    vertices.forEach(vertex => {
      longId = longId + '|' + vertex._id
      if (!(longId in maplevel)) {
        maplevel[longId] = {
          vid: vertex._id,
          name: Nugget.getLabel(vertex),
          type: Nugget.getType(vertex),
          children: {}
        }
      }
      maplevel = maplevel[longId].children
    })
  }

  // convert from dictionary-based format to array-based to match the format required by react-arborist
  #objToArr (maplevel) {
    const arr = []
    for (const [k, v] of Object.entries(maplevel)) {
      v.id = k
      v.children = this.#objToArr(v.children)
      arr.push(v)
    }
    return arr
  }

  // remove nuggets from a passage when they exist in a seam in that passage
  #dedupe () {
    function seamNuggets (level, id) {
      const vertex = level[id]
      const nugs = []
      if (vertex.type === 'nugget') nugs.push(vertex.vid)
      for (const [longId, val] of Object.entries(vertex.children)) {
        if (val.type === 'nugget') nugs.push(val.vid)
        nugs.push(...seamNuggets(vertex.children, longId))
      }
      return nugs
    }

    // this is a mess
    function dedupeLevel (level) {
      const seams = []
      for (const [id, val] of Object.entries(level)) {
        if (val.type === 'seam') seams.push(id)
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

  #seamsOnly (level) {
    for (const vertex of Object.values(level)) {
      if (vertex.type === 'seam') vertex.children = {}
      else this.#seamsOnly(vertex.children)
    }
    return level
  }

  toTree (seamsOnly = false) {
    let deduped = this.#dedupe()
    if (seamsOnly) deduped = this.#seamsOnly(deduped)
    const tree = this.#objToArr(deduped)
    return JSON.stringify(tree, null, 2)
  }
}
