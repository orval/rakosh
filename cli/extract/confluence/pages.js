const fetch = (...args) => import('node-fetch').then(({ default: fetch }) => fetch(...args))
const log = require('loglevel')
const { NuggetCatalog } = require('../lib/nugget_catalog')
const md2c = require('@shogobg/markdown2confluence')

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
      .catch(error => console.error('getPage', error))
  }

  getPages () {
    return fetch(`${this.wiki}/api/v2/pages`, {
      method: 'GET',
      headers: this.headers
    })
      .then(response => {
        if (response.status !== 200) {
          throw new Error(`${response.status} ${response.statusText}`)
        }
        return response.json()
      })
      .catch(error => console.error('getPages', error))
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
      .catch(error => console.error('getPageByTitle', error))
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
      .catch(error => console.error('addPage', error))
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
      .catch(error => console.error('updatePage', error))
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
      .catch(error => console.error('deletePage', error))
  }

  async addOrReplacePage (parentId, title, markdown) {
    this.initCheck()

    const page = await this.getPageByTitle(title)
    if (page) {
      const updatedPage = await this.updatePage(page.id, page.version.number + 1, title, markdown)
      log.info(`updated page ${updatedPage.id} "${title}"`)
      return updatedPage
    } else {
      const newPage = await this.addPage(parentId, title, markdown)
      log.info(`added page ${newPage.id} "${title}"`)
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

  const mdChunks = await catalog.getSeamNuggetChunks()

  // deal with duplicate labels
  const labels = {}
  for (const c of mdChunks) {
    if (c.label in labels) {
      const newLabel = `${c.label} - ${labels[c.label] + 1}`
      c.label = newLabel
    } else {
      labels[c.label] = 1
    }
  }

  const written = {}
  let parentId = confluence.startpageid

  for (const c of mdChunks) {
    if (c.key in written) {
      // console.log('already written', c.key)
      parentId = written[c.key]
    } else {
      const pageData = await confluence.addOrReplacePage(parentId, c.label, c.chunk)
      parentId = pageData.id
      written[c.key] = parentId
    }

    if ('children' in c) {
      for (const child of c.children) {
        // console.log('check child', parentId, child.key, child.depth)
        const chunk = catalog.getChunk(child.key, child.depth)

        if (!chunk) {
          // console.log('NOPE', child.key)
          continue
        }

        const childData = await confluence.addOrReplacePage(parentId, child.label, chunk)
        written[child.key] = childData.id
        // console.log('child added', childData.id)
      }
      // console.log('children done', parentId)
    }
  }
}
