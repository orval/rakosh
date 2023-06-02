const fetch = (...args) => import('node-fetch').then(({ default: fetch }) => fetch(...args))
const log = require('loglevel')
const { NuggetCatalog } = require('../lib/nugget_catalog')
const md2c = require('@shogobg/markdown2confluence')
const assert = require('assert')

class Confluence {
  constructor (argv) {
    this.spacekey = argv.spacekey
    this.startpageid = argv.startpageid
    this.headers = {
      Authorization: `Basic ${Buffer.from(argv.ccauth).toString('base64')}`,
      Accept: 'application/json',
      'Content-Type': 'application/json'
    }
    this.wiki = `https://${argv.domain}.atlassian.net/wiki`
    this.initialised = false
  }

  async init () {
    this.spaceId = await this.getSpaceId()
    this.initialised = true
  }

  initCheck () {
    if (!this.initialised) {
      throw new Error('must call init() first')
    }
  }

  async getSpaceId () {
    try {
      const spaces = await this.getSpaces()
      if (spaces.length === 1) {
        return spaces[0].id
      }
      log.error(`Space ${this.spacekey} not found`)
    } catch (error) {
      log.error(`Could not retrieve Confluence spaces [${error}]`)
      throw error
    }
  }

  getSpaces () {
    const queryString = new URLSearchParams({ keys: [this.spacekey] }).toString()
    return fetch(`${this.wiki}/api/v2/spaces?${queryString}`, { headers: this.headers })
      .then(response => {
        if (response.status !== 200) throw new Error(`${response.status} ${response.statusText}`)
        return response.text()
      })
      .then(j => JSON.parse(j).results)
  }

  static format (markdown) {
    return md2c(markdown, {
      codeBlock: {
        options: {
          title: '' // prevent 'none' title on all the code blocks
        }
      }
    })
  }

  getPage (pageId) {
    const queryString = new URLSearchParams({
      'body-format': 'storage'
    }).toString()

    return fetch(`${this.wiki}/api/v2/pages/${encodeURIComponent(pageId)}?${queryString}`, {
      method: 'GET',
      headers: this.headers
    })
      .then(response => {
        if (response.status !== 200) {
          throw new Error(`${response.status} ${response.statusText}`)
        }
        return response.json()
      })
      .then(data => data.id)
      .catch(error => log.error('getPage', error))
  }

  getPages () {
    const queryString = new URLSearchParams({
      status: 'current',
      limit: 250
    }).toString()

    return fetch(`${this.wiki}/api/v2/spaces/${encodeURIComponent(this.spaceId)}/pages?${queryString}`, {
      method: 'GET',
      headers: this.headers
    })
      .then(response => {
        if (response.status !== 200) {
          throw new Error(`${response.status} ${response.statusText}`)
        }
        return response.json()
      })
      .catch(error => log.error('getPages', error))
  }

  getPageByTitle (title) {
    const queryString = new URLSearchParams({
      spaceKey: this.spacekey,
      expand: 'body.storage,version',
      title
    }).toString()

    return fetch(
      `${this.wiki}/rest/api/content?${queryString}`,
      { headers: this.headers }
    )
      .then(response => {
        if (response.status !== 200) {
          throw new Error(`${response.status} ${response.statusText}`)
        }
        return response.json()
      })
      .then(data => data.results[0])
      .catch(error => log.error('getPageByTitle', error))
  }

  addPage (pageId, title, markdown) {
    const formatted = Confluence.format(markdown)
    return fetch(`${this.wiki}/api/v2/pages`, {
      method: 'POST',
      headers: this.headers,
      body: JSON.stringify({
        spaceId: this.spaceId,
        status: 'current',
        title,
        parentId: pageId,
        body: {
          representation: 'wiki',
          value: formatted
        }
      })
    })
      .then(response => {
        if (response.status !== 200) {
          throw new Error(`${response.status} ${response.statusText}`)
        }
        return response.json()
      })
      .catch(error => log.error('addPage', error))
  }

  updatePage (pageId, version, title, markdown) {
    const formatted = Confluence.format(markdown)
    return fetch(`${this.wiki}/api/v2/pages/${encodeURIComponent(pageId)}`, {
      method: 'PUT',
      headers: this.headers,
      body: JSON.stringify({
        id: pageId,
        spaceId: this.spaceId,
        status: 'current',
        title,
        body: {
          representation: 'wiki',
          value: formatted
        },
        version: {
          number: version
        }
      })
    })
      .then(response => {
        if (response.status !== 200) {
          throw new Error(`${response.status} ${response.statusText}`)
        }
        return response.json()
      })
      .catch(error => log.error('updatePage', error))
  }

  async deletePage (pageId) {
    return fetch(`${this.wiki}/api/v2/pages/${encodeURIComponent(pageId)}`, {
      method: 'DELETE',
      headers: this.headers
    })
      .then(response => {
        if (response.status !== 200) {
          throw new Error(`${response.status} ${response.statusText}`)
        }
        return response.text()
      })
      .catch(error => log.error('deletePage', error))
  }

  async addOrReplacePage (parentId, title, markdown) {
    this.initCheck()
    assert.ok(parentId)

    const page = await this.getPageByTitle(title)
    if (page) {
      const updatedPage = await this.updatePage(page.id, page.version.number + 1, title, markdown)
      log.info(`updated page ${updatedPage.id} "${title}"`)
      return updatedPage
    } else {
      const newPage = await this.addPage(parentId, title, markdown)
      if (newPage) {
        log.info(`added page ${newPage.id} "${title}"`)
      } else {
        log.error(`failed to add "${title}"`)
      }
      return newPage
    }
  }

  async deleteAllUnderStartPageId () {
    const pages = await this.getPages()
    for (const p of pages.results.filter(d => d.parentId === this.startpageid)) {
      log.info(`deleting page ${p.id}`)
      await this.deletePage(p.id)
    }
  }
}

exports.confluencePages = async function (db, argv) {
  const confluence = new Confluence(argv)
  await confluence.init()

  if (argv['delete-all-under-start-page-id']) {
    await confluence.deleteAllUnderStartPageId()
    return
  }

  const catalog = new NuggetCatalog(db, argv.include, argv.exclude, 0)
  await catalog.init()

  const root = await catalog.getSeamNuggetTree()

  // append confluence children macro to pages with children
  root.walk((n) => {
    if (n.hasChildren()) n.model.chunks.push('\n----\n\n{children}')

    // also create a path-like title, which will prevent duplicate titles
    const title = n.getPath().map(p => p.model.label).slice(1).join(' / ')
    n.model.title = title || n.model.label
    return true
  })

  function doPage (parentId, node) {
    return confluence.addOrReplacePage(parentId, node.model.title, node.model.chunks.join('\n'))
      .then((pageData) => {
        return pageData
      })
  }

  async function processNodes (nodes) {
    if (nodes.length === 0) return

    // reduce() ensures pages are added in order
    const children = []
    await nodes.reduce((prev, ent) => {
      return prev
        .then(() => doPage(ent.parent, ent.node))
        .then((pageData) => {
          return ent.node
            // find all children of this node
            .all(n => n.parent && n.parent.model._key === ent.node.model._key)
            .map(d => {
              children.push({ parent: pageData.id, node: d })
              return d.model._key
            })
        })
    }, Promise.resolve())

    await processNodes(children)
  }

  await processNodes([{ parent: confluence.startpageid, node: root }])
}
