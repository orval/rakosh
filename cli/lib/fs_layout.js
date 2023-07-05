'use strict'
const { statSync, readdirSync } = require('node:fs')
const { basename, join, resolve, extname } = require('node:path')
const TreeModel = require('tree-model')
const { Nugget } = require('./nugget')
const log = require('loglevel')
const inquirer = require('inquirer')
const { marked } = require('marked')
const TerminalRenderer = require('marked-terminal')
const yaml = require('js-yaml')

const RAKOSH_FS_LAYOUT_VERSION = '1.1'

marked.setOptions({
  renderer: new TerminalRenderer()
})

exports.FsLayout = class FsLayout {
  constructor (dir) {
    this.tree = new TreeModel({ modelComparatorFn: Nugget.compare })
    this.dir = dir
    console.time('myCode')
    this.init()
    console.timeEnd('myCode')
    // if (!statSync(dir).isDirectory()) {
    //   throw new Error(`${dir} is not a directory`)
    // }
  }

  init () {
    this.root = this.tree.parse({}) //  depth: 1, _key: 'adit' })
    this.#buildTree(this.root, this.dir, 1)

    // this.root.walk(function (node) {
    //   console.log(JSON.stringify(node.model, null, 2))
    //   return true
    // })

    // inquirer.registerPrompt('directory', require('inquirer-select-directory'))
    // inquirer.prompt([{
    //   type: 'directory',
    //   name: 'from',
    //   message: 'Where you like to put this component?',
    //   basePath: this.dir
    // }]).then(function (answers) {
    //   console.log(answers)
    // })
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

    // if (Object.keys(passageNuggets).length > 0) {
    //   log.warn(`WARNING: saved nugget passage(s) not added to collection [${JSON.stringify(passageNuggets)}]`)
    // }
  }

  interactive () {
    this.#wibble('Navigate', this.root)
  }

  #wibble (message, node) {
    if (!('children' in node.model)) {
      const entries = Object.assign({}, node.model)
      delete entries.body
      console.log(`---\n${yaml.dump(entries).trim()}\n---`)
      // console.log(marked(node.model.body))
      this.#wibble('Navigate', node.parent)
      return
    }

    // console.log('wibble', JSON.stringify(node.model.children, null, 2))
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
        // console.log('A', answers)
        if (answers.floop === '__exit__') return
        if (answers.floop === '..') this.#wibble('Navigate', node.parent)

        let childNode = node.first(n => n.model._key === answers.floop)
        if (!childNode) {
          childNode = node.first(n => n.model.label === answers.floop)
        }
        // console.log('__', childNode)
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

  // readDir (dir, parent) {
  //   const dirContents = readdirSync(dir, { withFileTypes: true })
  //   const mdFiles = dirContents.filter(e => e.isFile() && extname(e.name) === '.md')
  //   const dirs = dirContents.filter(e => e.isDirectory())

  //   for (const mdFile of mdFiles) {
  //     const base = basename(mdFile.name, '.md')
  //     const fsPath = join(dir, mdFile.name)

  //     let nugget
  //     try {
  //       nugget = Nugget.fromMdFile(resolve(fsPath))
  //       nugget.fspath = fsPath
  //     } catch (error) {
  //       log.warn(`WARNING: ${mdFile.name} does not appear to be a rakosh nugget file [${error}]`)
  //       continue
  //     }

  //     if (nugget._key === 'adit') {
  //       // check for presence of layout version -- allow for later version changes
  //       if (!nugget.fs_layout) {
  //         log.warn(`WARNING: no 'fs_layout' in ${base}.md, assuming version ${RAKOSH_FS_LAYOUT_VERSION}`)
  //       } else if (nugget.fs_layout !== RAKOSH_FS_LAYOUT_VERSION) {
  //         log.error(`ERROR: unknown 'fs_layout' ${nugget.fs_layout}, tool knows ${RAKOSH_FS_LAYOUT_VERSION}`)
  //       }
  //       // update the adit vertex with a document from this file
  //       ///// update this.root
  //       continue
  //     }
  //   }

  //   for (const dir of dirs) {
  //   }
  // }
}
