const { basename } = require('node:path')
const { format } = require('node:util')
const { readFileSync } = require('node:fs')
const markdownlint = require('markdownlint')
const fm = require('front-matter')
const yaml = require('js-yaml')

const lintConf = {
  'line-length': false,
  'first-line-heading': false
}

exports.Nugget = class Nugget {
  static PASSAGE = 'passage'
  static SEAM = 'seam'
  static NUGGET = 'nugget'
  static Types = [Nugget.PASSAGE, Nugget.SEAM, Nugget.NUGGET]

  constructor (attributes, body = undefined) {
    // NUGGET type by default
    this.type = Nugget.NUGGET

    // the attributes become entries of this
    for (const [key, value] of Object.entries(attributes)) {
      this[key] = value
    }

    // passage in front matter sets PASSAGE type
    if ('passage' in attributes) this.type = Nugget.PASSAGE
    else if ('seam' in attributes) this.type = Nugget.SEAM

    // set label from the body if possible, fall back to 'label' then '_key'
    if (body) {
      this.body = body // also set body in 'this'

      const match = body.match(/^(#+)\s(.+)$/gm)
      if (match) {
        this.label = match[0].replace(/^[#\s]*/, '')
      } else {
        const label = body.replace(/^\s*/, '')
        this.label = (label.length > 25) ? label.slice(0, 24).concat('…') : label
      }
    } else if ('_key' in attributes && !('label' in attributes)) {
      this.label = attributes._key
    }

    // check type is allowed
    if (!Nugget.Types.includes(this.type)) {
      throw new Error(`Unknown Nugget type ${this.type}`)
    }
  }

  static fromMdFile (mdFile) {
    const content = readFileSync(mdFile, { encoding: 'utf-8' })
    const errors = markdownlint.sync({ strings: { content }, config: lintConf })
    if (errors.content.length > 0) {
      throw new Error('Markdown issue in [' + mdFile + ']:' + errors.toString())
    }
    const markdown = fm(content)
    markdown.attributes._key = basename(mdFile, '.md')
    return new Nugget(markdown.attributes, markdown.body)
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

  // generate an MDX component including all keys in YAML frontmatter
  getMdxWithFrontMatter (additions = {}, append = '') {
    const entries = Object.assign(additions, this.document)
    delete entries.body
    return format('---\n%s---\n%s', yaml.dump(entries), this.getMdx(additions, append))
  }

  // generate an MDX component named after the type
  getMdx (additions = {}, append = '') {
    const component = this.type.charAt(0).toUpperCase() + this.type.slice(1)
    const entries = Object.assign(additions, this.document)
    delete entries.body

    return format(
      '<%s %s>\n%s\n%s\n</%s>\n',
      component,
      Object.keys(entries).map(a => `${a}="${entries[a]}"`).join(' '),
      ('body' in this) ? this.body : '### ' + this.label,
      append,
      component
    )
  }

  // create a label from the nugget contents
  static getLabel (nugget) {
    if ('body' in nugget) {
      const match = nugget.body.match(/^(#+)\s(.+)$/gm)
      if (match) return match[0].replace(/^[#\s]*/, '')

      const label = nugget.body.replace(/^\s*/, '')
      return (label.length > 25) ? label.slice(0, 24).concat('…') : label
    }

    if ('label' in nugget) return nugget.label
    return nugget._key
  }
}
