'use strict'
import { statSync, readdirSync, writeFileSync, mkdirSync } from 'node:fs'
import { basename, join, extname } from 'node:path'

import yaml from 'js-yaml'
import _ from 'lodash'
import log from 'loglevel'
import { marked } from 'marked'
import TerminalRenderer from 'marked-terminal'
import prompts from 'prompts'
import { median } from 'simple-statistics'
import TreeModel from 'tree-model'
import { v4 as uuidv4 } from 'uuid'

import { Nugget } from './nugget.js'

const RAKOSH_FS_LAYOUT_VERSION = '1.2'

const STANDARD_TAGS = _.zipObject([
  'type',
  '_key',
  'passage',
  'body',
  'label',
  'shortlabel',
  'fspath',
  'children',
  'nuggets',
  '__media',
  'pageRefs'
])

marked.setOptions({
  renderer: new TerminalRenderer()
})

export class FsLayout {
  constructor (dir) {
    this.tree = new TreeModel({ modelComparatorFn: Nugget.compare })
    this.dir = dir
    this.init()
  }

  init () {
    this.root = this.tree.parse({})
    this.#buildTree(this.root, this.dir, 1)
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
      log.warn(`WARNING: path already exists [${path}]`)
    }
  }

  size () {
    return this.root.all(() => true).length
  }

  #fileDoesNotExist (filepath) {
    try {
      statSync(filepath)
    } catch (err) {
      if (err.code === 'ENOENT') return true
    }
    return false
  }

  addNugget (path, title, additions = {}) {
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
      yaml.dump(Object.assign(additions, tags)).trim(),
      '---',
      `\n${this.#getChildHeader(this.root)} ${title}\n`
    ].join('\n'))

    log.info(`new nugget "${title}" with _key ${tags._key} added at [${path}]`)
  }

  createAdit (path, title) {
    const tags = {
      _key: 'adit',
      fs_layout: RAKOSH_FS_LAYOUT_VERSION
    }

    writeFileSync(path, [
      '---',
      yaml.dump(tags).trim(),
      '---',
      `\n# ${title}\n`
    ].join('\n'))

    log.info(`adit created at [${path}]`)
  }

  addPassage (path, title) {
    const mdFile = path + '.md'
    if (this.#fileDoesNotExist(mdFile)) {
      mkdirSync(path)
      log.info(`directory created [${path}]`)
      const passage = basename(path)
      this.addNugget(mdFile, title, { passage })
    } else {
      log.warn(`WARNING: passage nugget already exists [${path}]`)
    }
  }

  #getChildTags (node) {
    const children = node.model.children ?? []

    // get arrays of the non-standard tag values
    return children.reduce((acc, cur) => {
      for (const [k, v] of Object.entries(cur)) {
        if (k in STANDARD_TAGS) continue
        if (k in acc) acc[k].push(v)
        else acc[k] = [v]
      }
      return acc
    }, {})
  }

  #getChildHeader (node) {
    const children = node.model.children ?? []

    // use the child node headers to work out the new header level
    const levels = children.reduce((acc, cur) => {
      if ('body' in cur) {
        const match = /^(#+)\s+/.exec(cur.body)
        if (match && match.length > 1) acc.push(match[1].length)
      }
      return acc
    }, [])

    if (levels.length === 0) return '###' // arbitrarily use 3 levels when unknown
    return '#'.repeat(median(levels))
  }

  #buildTree (parent, dir) {
    const dirContents = readdirSync(dir, { withFileTypes: true })
    const passageNuggets = {}

    // process markdown files
    const mdFiles = dirContents.filter(e => e.isFile() && extname(e.name) === '.md')
    for (const mdFile of mdFiles) {
      const base = basename(mdFile.name, '.md')
      const fsPath = join(dir, mdFile.name)

      // check all markdown files
      if (mdFile.name.endsWith('.md')) {
        let nugget
        try {
          nugget = Nugget.fromMdFile(fsPath)
        } catch (error) {
          log.warn(`WARNING: ${mdFile.name} is not a valid rakosh nugget file [${error}]`)
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
          nugget.type = Nugget.PASSAGE
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

    // create nodes to represent links
    const linkFiles = dirContents.filter(e => e.isSymbolicLink() && extname(e.name) === '.md')
    for (const lnFile of linkFiles) {
      const fsPath = join(dir, lnFile.name)
      let nugget
      try {
        nugget = Nugget.fromMdFile(fsPath)
        nugget.link = `${nugget.type}/${nugget._key}`
      } catch (error) {
        log.warn(`WARNING: ${lnFile.name} is not a valid rakosh nugget file [${error}]`)
        continue
      }
      parent.addChild(this.tree.parse(nugget.document))
    }

    const dirs = dirContents.filter(e => e.isDirectory())
    for (const d of dirs) {
      let passageNode

      if (d.name in passageNuggets) {
        passageNode = passageNuggets[d.name]
        delete passageNuggets[d.name]
      } else {
        const node = this.tree.parse({
          type: Nugget.PASSAGE,
          label: d.name,
          passage: d.name,
          fspath: join(dir, d.name)
        })
        passageNode = parent.addChild(node)
      }

      // recurse down the directory tree
      this.#buildTree(passageNode, join(dir, d.name))
    }

    if (Object.keys(passageNuggets).length > 0) {
      log.warn(`WARNING: passage nugget(s) found without an associated directory [${JSON.stringify(Object.keys(passageNuggets))}]`)
    }
  }

  interactive () {
    this.#interactiveLoop(this.root)
  }

  #interactiveLoop (node) {
    if (node === undefined) return

    if (!('children' in node.model)) {
      const entries = Object.assign({}, node.model)
      delete entries.body
      log.info(`---\n${yaml.dump(entries).trim()}\n---`)
      this.#interactiveLoop(node.parent)
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
      // choices.push({ title: 'Add nugget', value: '__newnug__' })
      // choices.push({ title: 'Add passage', value: '__newpass__' })
      choices.unshift({ title: '⬆️', value: '..', short: ' ' })
      choices.push({ title: 'Exit', value: '__exit__' })

      const response = await prompts({
        type: 'select',
        name: 'value',
        message: '',
        choices,
        initial: 1
      })

      if (response.value === '__exit__') return
      if (response.value === '..') {
        this.#interactiveLoop(node.parent)
        return
      }

      let childNode = node.first(n => n.model._key === response.value)
      if (!childNode) {
        childNode = node.first(n => n.model.label === response.value)
      }
      this.#interactiveLoop(childNode)
    })()
  }
}
