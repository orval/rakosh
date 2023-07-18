'use strict'
const _ = require('lodash')
const { v4: uuidv4 } = require('uuid')
const { statSync, readdirSync, writeFileSync } = require('node:fs')
const { basename, join, resolve, extname } = require('node:path')
const TreeModel = require('tree-model')
const { Nugget } = require('./nugget')
const log = require('loglevel')
const inquirer = require('inquirer')
const { marked } = require('marked')
const TerminalRenderer = require('marked-terminal')
const yaml = require('js-yaml')
const prompts = require('prompts')
const ss = require('simple-statistics')

const RAKOSH_FS_LAYOUT_VERSION = '1.1'

const STANDARD_TAGS = _.zipObject([
  'type',
  'depth',
  '_key',
  'passage',
  'body',
  'label',
  'fspath',
  'children',
  'nuggets'
])

marked.setOptions({
  renderer: new TerminalRenderer()
})

exports.FsLayout = class FsLayout {
  constructor (dir) {
    this.tree = new TreeModel({ modelComparatorFn: Nugget.compare })
    this.dir = dir
    this.init()
  }

  init () {
    this.root = this.tree.parse({})
    this.#buildTree(this.root, this.dir, 1)

    // this.root.walk(function (node) {
    //   console.log(JSON.stringify(node.model, null, 2))
    //   return true
    // })
  }

  add (path, title) {
    if (this.#fileDoesNotExist(path)) {
      const ext = extname(path)
      if (ext === '') {
        this.addPassage(path, title)
      } else if (ext === '.md') {
        this.addNugget(path, title)
      } else {
        log.error(`file type ${ext} not supported`)
      }
    } else {
      log.error(`${path} already exists`)
    }
  }

  #fileDoesNotExist (filepath) {
    try {
      statSync(filepath)
    } catch (err) {
      if (err.code === 'ENOENT') return true
    }
    return false
  }

  addNugget (path, title) {
    const tags = this.#getChildTags(this.root)

    // set the next order value if order tags exist
    if ('order' in tags) {
      tags.order = _.last(tags.order.sort()) + 1
    }

    // convert tag arrays into suggestion strings
    for (const [k, v] of Object.entries(tags)) {
      if (k === 'order') continue
      tags[k] = _.uniq(v).join(', ')
    }

    // create a unique key
    tags._key = uuidv4()

    writeFileSync(path, [
      '---',
      yaml.dump(tags).trim(),
      '---',
      `\n${this.#getChildHeader(this.root)} ${title}\n`
    ].join('\n'))

    log.info(`New nugget "${title}" with _key ${tags._key} added at [${path}]`)
  }

  #getChildTags (node) {
    // get arrays of the non-standard tag values
    return node.model.children.reduce((acc, cur) => {
      for (const [k, v] of Object.entries(cur)) {
        if (k in STANDARD_TAGS) continue
        if (k in acc) acc[k].push(v)
        else acc[k] = [v]
      }
      return acc
    }, {})
  }

  #getChildHeader (node) {
    // use the child node headers to work out the new header level
    const levels = node.model.children.reduce((acc, cur) => {
      if ('body' in cur) {
        const match = /^(#+)\s+/.exec(cur.body)
        if (match && match.length > 1) acc.push(match[1].length)
      }
      return acc
    }, [])
    return '#'.repeat(ss.median(levels))
  }

  #buildTree (parent, dir, depth) {
    const dirContents = readdirSync(dir, { withFileTypes: true })
    const mdFiles = dirContents.filter(e => e.isFile() && extname(e.name) === '.md')
    const dirs = dirContents.filter(e => e.isDirectory())
    const passageNuggets = {}

    // process markdown files
    for (const mdFile of mdFiles) {
      const base = basename(mdFile.name, '.md')
      const fsPath = join(dir, mdFile.name)

      // check all markdown files
      if (mdFile.name.endsWith('.md')) {
        let nugget
        try {
          nugget = Nugget.fromMdFile(resolve(fsPath))
          nugget.fspath = fsPath
          nugget.depth = depth
          // delete nugget.body
        } catch (error) {
          log.warn(`WARNING: ${mdFile.name} does not appear to be a rakosh nugget file [${error}]`)
          continue
        }

        if (nugget._key === 'adit') {
          // check for presence of layout version -- allow for later version changes
          if (!nugget.fs_layout) {
            log.warn(`WARNING: no 'fs_layout' in ${base}.md, assuming version ${RAKOSH_FS_LAYOUT_VERSION}`)
          } else if (nugget.fs_layout !== RAKOSH_FS_LAYOUT_VERSION) {
            log.error(`ERROR: unknown 'fs_layout' ${nugget.fs_layout}, tool knows ${RAKOSH_FS_LAYOUT_VERSION}`)
          }
          // update the adit vertex with a document from this file
          nugget.depth = 0
          this.root.model = nugget.document
          continue
        }

        const node = this.tree.parse(nugget.document)
        parent.addChild(node)

        if ('passage' in nugget) {
          passageNuggets[nugget.passage] = node
        }
      }
    }

    for (const d of dirs) {
      let passageNode

      if (d.name in passageNuggets) {
        passageNode = passageNuggets[d.name]
        delete passageNuggets[d.name]
      } else {
        const node = this.tree.parse({
          depth,
          label: d.name,
          passage: d.name,
          fspath: join(dir, d.name)
        })
        passageNode = parent.addChild(node)
      }

      // recurse down the directory tree
      this.#buildTree(passageNode, join(dir, d.name), depth++)
    }

    if (Object.keys(passageNuggets).length > 0) {
      log.warn(`WARNING: saved nugget passage(s) not added to collection [${JSON.stringify(passageNuggets)}]`)
    }
  }

  interactive () {
    this.#wobble('Navigate', this.root)
  }

  #wobble (msg, node) {
    if (!('children' in node.model)) {
      const entries = Object.assign({}, node.model)
      delete entries.body
      log.info(`---\n${yaml.dump(entries).trim()}\n---`)
      this.#wobble('Navigate', node.parent)
      return
    }

    (async () => {
      const choices = node.model.children.map(c => {
        let prefix = '📂'
        switch (c.type) {
          case 'nugget':
            prefix = 'ℹ️ '
            break
          case 'passage':
            prefix = '🗂️ '
            break
        }
        return {
          title: `${prefix} - ${c.label}`,
          value: ('_key' in c) ? c._key : c.label
        }
      })
      // choices.push(new inquirer.Separator())
      // choices.push({ title: 'Add nugget', value: '__newnug__' })
      // choices.push({ title: 'Add passage', value: '__newpass__' })
      // choices.push({ title: 'Exit', value: '__exit__' })
      if (node.model.depth > 0) {
        choices.unshift({ title: '⬆️', value: '..', short: ' ' })
      }

      const response = await prompts({
        type: 'select',
        name: 'value',
        message: '',
        choices,
        initial: 1
      })

      if (response.value === '__exit__') return
      if (response.value === '..') {
        this.#wobble('Navigate', node.parent)
        return
      }

      let childNode = node.first(n => n.model._key === response.value)
      if (!childNode) {
        childNode = node.first(n => n.model.label === response.value)
      }
      this.#wobble('Navigate', childNode)
    })()
  }

  #wibble (message, node) {
    if (!('children' in node.model)) {
      const entries = Object.assign({}, node.model)
      delete entries.body
      log.info(`---\n${yaml.dump(entries).trim()}\n---`)
      this.#wibble('Navigate', node.parent)
      return
    }

    const choices = node.model.children.map(c => {
      let prefix = '📂'
      switch (c.type) {
        case 'nugget':
          prefix = 'ℹ️ '
          break
        case 'passage':
          prefix = '🗂️ '
          break
      }
      return {
        name: `${prefix} - ${c.label}`,
        value: ('_key' in c) ? c._key : c.label
      }
    })
    choices.push(new inquirer.Separator())
    choices.push({ name: 'Add nugget', value: '__newnug__' })
    choices.push({ name: 'Add passage', value: '__newpass__' })
    choices.push({ name: 'Exit', value: '__exit__' })
    if (node.model.depth > 0) {
      choices.unshift({ name: '⬆️', value: '..', short: ' ' })
    }

    inquirer
      .prompt([{
        type: 'list',
        message: node.model.label,
        name: 'floop',
        choices,
        pageSize: 10
      }])
      .then((answers) => {
        if (answers.floop === '__exit__') return
        if (answers.floop === '..') this.#wibble('Navigate', node.parent)

        let childNode = node.first(n => n.model._key === answers.floop)
        if (!childNode) {
          childNode = node.first(n => n.model.label === answers.floop)
        }
        this.#wibble('Navigate', childNode)
      })
      .catch((error) => {
        if (error.isTtyError) {
          log.error('Prompt could not be rendered in the current environment')
        } else {
          log.error(`Something else went wrong: ${error}`)
        }
      })
  }
}
