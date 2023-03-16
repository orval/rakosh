const { basename } = require('node:path')
const { readFileSync } = require('node:fs')
const markdownlint = require('markdownlint')
const fm = require('front-matter')

const lintConf = {
  'line-length': false,
  'first-line-heading': false
}

exports.Nugget = class Nugget {
  constructor (mdFile) {
    this._key = basename(mdFile, '.md')
    const content = readFileSync(mdFile, { encoding: 'utf-8' })

    const errors = markdownlint.sync({ strings: { content }, config: lintConf })
    if (errors.content.length > 0) {
      throw new Error('Markdown issue in [' + mdFile + ']:' + errors.toString())
    }

    const markdown = fm(content)
    this.body = markdown.body

    for (const [key, value] of Object.entries(markdown.attributes)) {
      this[key] = value
    }

    // if (!('seam_id' in this)) { this.seam_id = 1 }

    // kludge link to source file
    // this.source = path.replace(argv[2], 'https://gitlab.laputa.veracode.io/orval/vkb/-/blob/main')
  }

  static compare (a, b) {
    return a.seam_id - b.seam_id
  }

  get document () {
    // for now all entries go into the ArangoDB Document
    return this
  }

  // create a label from the nugget contents
  static getLabel (nugget) {
    if ('label' in nugget) return nugget.label
    if (!('body' in nugget)) return nugget._key

    const match = nugget.body.match(/^(#+)\s(.+)$/gm)
    if (match) return match[0].replace(/^[#\s]*/, '')

    const label = nugget.body.replace(/^\s*/, '')
    return (label.length > 25) ? label.slice(0, 24).concat('…') : label
  }

  // this class needs tidying up...
  static getType (nugget) {
    if ('type' in nugget) return nugget.type
    if ('passage' in nugget) return 'passage'
    return 'nugget'
  }
}
