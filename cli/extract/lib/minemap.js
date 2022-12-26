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
          name: Nugget.getLabel(vertex),
          children: {}
        }
      }
      maplevel = maplevel[longId].children
    })
  }

  #objToArr (maplevel) {
    const arr = []
    for (const [k, v] of Object.entries(maplevel)) {
      v.id = k
      v.children = this.#objToArr(v.children)
      arr.push(v)
    }
    return arr
  }

  toTree () {
    const tree = this.#objToArr(this.minemap)
    return JSON.stringify(tree, null, 2)
  }
}
