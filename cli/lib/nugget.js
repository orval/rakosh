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

    if (body) this.body = body

    // passage in front matter sets PASSAGE type
    if ('passage' in attributes) this.type = Nugget.PASSAGE
    else if ('seam' in attributes) this.type = Nugget.SEAM

    this.label = this.getLabel()

    // check type is allowed
    if (!Nugget.Types.includes(this.type)) {
      throw new Error(`Unknown Nugget type ${this.type}`)
    }
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

  // 'order' keys sort first, then it's alphabetical on label
  static compare (a, b) {
    if (a.order && b.order) return a.order - b.order
    if (a.order && !b.order) return -1
    if (!a.order && b.order) return 1
    return a.label.localeCompare(b.label)
  }

  get document () {
    // for now all entries go into the ArangoDB Document
    return this
  }

  // generate YAML front matter for MDX file
  getFrontMatter (additions = {}) {
    const entries = Object.assign(additions, this.document)
    delete entries.body
    return format('---\n%s---\n', yaml.dump(entries))
  }

  #getBreadcrumbs () {
    if (this.breadcrumbs.length === 0) return ''
    const bcrumbs = ['<Breadcrumbs>']

    for (const b of this.breadcrumbs) {
      bcrumbs.push('<Crumbs>')
      bcrumbs.push(b.map(c => format('<Crumb id="%s" label="%s" />', c._id, c.label)).join(''))
      bcrumbs.push('</Crumbs>')
    }
    bcrumbs.push('</Breadcrumbs>')
    return bcrumbs.join('\n')
  }

  // generate an MDX component named after the type
  getMdx (additions = {}, append = '') {
    const component = this.type.charAt(0).toUpperCase() + this.type.slice(1)
    const entries = Object.assign(additions, this.document)
    delete entries.body
    delete entries.breadcrumbs

    // it is decreed that breadcrumbs are not required in outbound vertices
    const breadcrumbs = (entries.direction === 'outbound') ? '' : this.#getBreadcrumbs()

    const mostOfTheMdx = format(
      '<%s %s>\n<NuggetBody>\n%s\n</NuggetBody>\n%s\n%s',
      component,
      Object.keys(entries).map(a => `${a}="${entries[a]}"`).join(' '),
      ('body' in this) ? this.body : '### ' + this.label,
      breadcrumbs,
      append
    )

    // mostly pointless tidying up of the MDX
    return format('%s\n</%s>\n', mostOfTheMdx.trimEnd(), component)
  }
}
