const { join, dirname } = require('node:path')
const { readFileSync } = require('node:fs')

exports.Media = class Media {
  static MARKDOWN = 'text/markdown; charset=UTF-8'
  static Types = [
    Media.MARKDOWN,
    'image/png'
  ]

  constructor (attributes) {
    this.media_type = ('media_type' in attributes) ? attributes.media_type : Media.MARKDOWN

    // check type is supported
    if (!Media.Types.includes(this.media_type)) {
      throw new Error(`Unknown media type ${this.media_type}`)
    }

    if ('media_path' in attributes) {
      this.media_relpath = join(dirname(attributes.fspath), attributes.media_path)
      readFileSync(this.media_relpath) // throws exception if the file does not exist
    }
  }
}
