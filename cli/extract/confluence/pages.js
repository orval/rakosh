import assert from 'assert'

import { FormData } from 'formdata-node'
import { fileFromPathSync } from 'formdata-node/file-from-path'
import log from 'loglevel'
import md2c from '@shogobg/markdown2confluence'
import fetch from 'node-fetch'

import { NuggetCatalog } from '../lib/nugget_catalog.js'

class Confluence {
  constructor (argv) {
    this.spacekey = argv.spacekey
    this.startpageid = argv.startpageid
    this.authHeaders = {
      Authorization: `Basic ${Buffer.from(argv.ccauth).toString('base64')}`
    }
    this.headers = {
      ...this.authHeaders,
      Accept: 'application/json',
      'Content-Type': 'application/json'
    }
    this.wiki = `https://${argv.domain}.atlassian.net/wiki`
    this.initialised = false
    this.lookup = new Map()
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

  addLookupUrl (key, url) {
    if (!this.lookup.has(key)) {
      this.lookup.set(key, [])
    }
    const urls = this.lookup.get(key)
    if (!urls.includes(url)) {
      urls.push(url)
    }
  }

  getLookup () {
    const obj = {}
    for (const [key, value] of this.lookup) {
      obj[key] = value
    }
    return JSON.stringify(obj, null, 2)
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
      expand: 'body.view,version',
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

  deletePage (pageId) {
    return fetch(`${this.wiki}/api/v2/pages/${encodeURIComponent(pageId)}`, {
      method: 'DELETE',
      headers: this.headers
    })
      .then(response => {
        if (response.status !== 200 && response.status !== 204) {
          throw new Error(`${response.status} ${response.statusText}`)
        }
        return response.text()
      })
      .catch(error => log.error('deletePage', error))
  }

  attach (pageId, uuidName, media) {
    const file = fileFromPathSync(media.relpath, uuidName, { type: media.type })

    const formData = new FormData()
    formData.append('file', file)
    formData.append('minorEdit', 'true')
    // TODO formData.append('comment', <alt text or title>)

    return fetch(
      `${this.wiki}/rest/api/content/${pageId}/child/attachment`,
      {
        method: 'PUT',
        headers: { 'X-Atlassian-Token': 'nocheck', ...this.authHeaders },
        body: formData
      }
    )
      .then(response => {
        if (response.status !== 200) {
          throw new Error(`${response.status} ${response.statusText}`)
        }
        return response.json()
      })
      .then(data => data.results[0])
      .catch(error => log.error('attach', error))
  }

  async addOrReplacePage (catalog, parentId, node) {
    this.initCheck()
    assert.ok(parentId)
    const nugget = catalog.fromNode(node)
    const markdown = nugget.page

    const page = await this.getPageByTitle(nugget.title)
    if (page) {
      const updatedPage = await this.updatePage(
        page.id,
        page.version.number + 1,
        nugget.title,
        markdown
      )

      log.info(`updated page ${updatedPage.id} "${nugget.title}"`)

      // TODO do this for `add` as well
      for (const [uuidName, media] of Object.entries(nugget.refs)) {
        await this.attach(updatedPage.id, uuidName, media)
        log.info(`attached ${uuidName} to page ${updatedPage.id}`)
      }

      return updatedPage
    } else {
      const newPage = await this.addPage(parentId, nugget.title, markdown)
      if (newPage) {
        log.info(`added page ${newPage.id} "${nugget.title}"`)
      } else {
        log.error(`failed to add "${nugget.title}"`)
      }
      return newPage
    }
  }

  async deleteAllUnderStartPageId () {
    const pages = await this.getPages()
    for (const p of pages.results.filter(d => Number(d.parentId) === this.startpageid)) {
      log.info(`deleting page ${p.id}`)
      await this.deletePage(p.id)
    }
  }
}

export async function confluencePages (db, argv) {
  const confluence = new Confluence(argv)
  await confluence.init()

  if (argv['delete-all-under-start-page-id']) {
    await confluence.deleteAllUnderStartPageId()
    return
  }

  const catalog = new NuggetCatalog(db, argv.include, argv.exclude)
  await catalog.init()

  const root = await catalog.getSeamNuggetTree()

  // append confluence children macro to pages with children
  root.walk((n) => {
    const nugget = catalog.fromNode(n)
    if (n.hasChildren()) nugget.page += '\n----\n\n{children}'

    // also create a path-like title, which will prevent duplicate titles
    const title = n.getPath().map(p => catalog.fromNode(p).label).slice(1).join(' / ')
    nugget.title = title || nugget.label
    return true
  })

  if (argv.treedebug) {
    // hidden option for just printing the tree
    root.walk((n) => console.log(catalog.fromNode(n)))
    return
  }

  function getPageInfo (catalog, _, node) {
    // this read-only version populates the Nugget key versus URL lookup
    const nugget = catalog.fromNode(node)
    return confluence.getPageByTitle(nugget.title).then(pageData => {
      if (pageData) {
        confluence.addLookupUrl(nugget._key, pageData._links.webui)
      }
      return pageData
    })
  }

  function doPage (catalog, parentId, node) {
    return confluence.addOrReplacePage(catalog, parentId, node)
  }

  async function processNodes (catalog, nodes, processFn) {
    if (nodes.length === 0) return

    // reduce() ensures pages are added in order
    const children = []
    await nodes.reduce((prev, ent) => {
      return prev
        .then(() => processFn(catalog, ent.parent, ent.node))
        .then((pageData) => {
          return ent.node
            // find all children of this node
            .all(n => n.parent && n.parent.model._key === ent.node.model._key)
            .map(d => {
              if (pageData) {
                children.push({ parent: pageData.id, node: d })
              }
              return d.model._key
            })
        })
    }, Promise.resolve())

    await processNodes(catalog, children, processFn)
  }

  const start = [{ parent: confluence.startpageid, node: root }]
  await processNodes(catalog, start, getPageInfo)

  if (argv.lookup) {
    console.log(confluence.getLookup())
  } else {
    await processNodes(catalog, start, doPage)
  }
}
