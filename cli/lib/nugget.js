import { format } from 'node:util'
import { readFileSync } from 'node:fs'

import fm from 'front-matter'
import markdownlint from 'markdownlint'
import yaml from 'js-yaml'

import { Media } from './media.js'

const lintConf = {
  'line-length': false,
  'first-line-heading': false
}

export class Nugget {
  static PASSAGE = 'passage'
  static NUGGET = 'nugget'
  static Types = [Nugget.PASSAGE, Nugget.NUGGET]
  static UUID_RE = /^[0-9a-fA-F]{8}-(?:[0-9a-fA-F]{4}-){3}[0-9a-fA-F]{12}$/

  constructor (attributes, body = undefined) {
    // NUGGET type by default
    this.type = Nugget.NUGGET

    // the attributes become entries of this
    for (const [key, value] of Object.entries(attributes)) {
      this[key] = value
    }

    if (!this._key) throw new Error('no _key attribute in Nugget')
    if (!this.fspath) throw new Error('no fspath attribute in Nugget')
    if (this._key === 'adit') this.passage = '.'

    if (body) this.body = body

    // passage in front matter sets PASSAGE type
    if ('passage' in attributes) this.type = Nugget.PASSAGE

    this.label = this.getLabel()

    // check type is allowed
    if (!Nugget.Types.includes(this.type)) {
      throw new Error(`Unknown Nugget type ${this.type}`)
    }

    if ('__media' in attributes) {
      this.__media = new Media(this.fspath, attributes.__media)
    }

    this.chunk = []
    this.refs = {}
  }

  // if there's no label attribute get it from the body, falling back to '_key'
  getLabel () {
    if (this.label) return this.label
    if (!this.body) return this._key

    const match = this.body.match(/^(#+)\s(.+)$/gm)
    if (match) return match[0].replace(/^[#\s]*/, '')

    // trim any preceeding white space and limit to 25 characters long
    const label = this.body.replace(/^\s*/, '')
    return (label.length > 25) ? label.slice(0, 24).concat('…') : label
  }

  static fromMdFile (relativePath) {
    const content = readFileSync(relativePath, { encoding: 'utf-8' })
    const errors = markdownlint.sync({ strings: { content }, config: lintConf })
    if (errors.content.length > 0) {
      throw new Error(`Markdown issue in [${relativePath}]:` + errors.toString())
    }
    const markdown = fm(content)
    markdown.attributes.fspath = relativePath
    return new Nugget(markdown.attributes, markdown.body)
  }

  // 'order' keys sort first, then it's alphabetical on label
  static compare (a, b) {
    if (a.order && b.order) return a.order - b.order
    if (a.order && !b.order) return -1
    if (!a.order && b.order) return 1
    return a.label.localeCompare(b.label)
  }

  // a document is a representation for use in ArangoDB
  get document () {
    // remove items that do not need to be stored
    const obj = Object.assign({}, this)
    delete obj.refs
    delete obj.chunk
    return obj
  }

  // generate YAML front matter for MDX file
  getFrontMatter (additions = {}) {
    const entries = Object.assign(additions, this.document)
    delete entries.body
    return format('---\n%s---\n', yaml.dump(entries))
  }

  getBreadcrumbs () {
    if (this.breadcrumbs.length === 0) return ''
    const bcrumbs = ['<Breadcrumbs>']

    for (const b of this.breadcrumbs) {
      bcrumbs.push('<Crumbs>')
      bcrumbs.push(b.map(c => format('<Crumb _key="%s" label="%s" />', c._key, c.label)).join(''))
      bcrumbs.push('</Crumbs>')
    }
    bcrumbs.push('</Breadcrumbs>')
    return bcrumbs.join('\n')
  }
}
