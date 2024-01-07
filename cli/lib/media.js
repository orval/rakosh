const { join, dirname } = require('node:path')
const { readFileSync } = require('node:fs')

exports.Media = class Media {
  static MARKDOWN = 'text/markdown; charset=UTF-8'
  static PNG = 'image/png'

  static Types = [
    Media.MARKDOWN,
    Media.PNG
  ]

  constructor (fspath, obj) {
    if (!obj.path) throw new Error('No path attribute in Media')
    if (!obj.type) throw new Error('No type attribute in Media')

    // check type is supported
    if (!Media.Types.includes(obj.type)) {
      throw new Error(`Unknown media type ${obj.type}`)
    }

    this.path = obj.path
    this.type = obj.type

    this.relpath = join(dirname(fspath), this.path)
    readFileSync(this.relpath) // throws exception if the file does not exist
  }
}
