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
    this.domain = argv.domain + '.atlassian.net'
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
    return fetch(`https://${this.domain}/wiki/api/v2/spaces?${queryString}`, { headers: this.headers })
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

    return fetch(`https://${this.domain}/wiki/api/v2/pages/${encodeURIComponent(pageId)}?${queryString}`, {
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
  }

  getPageByTitle (title) {
    const queryString = new URLSearchParams({
      spaceKey: this.spacekey,
      expand: 'body.storage,version',
      title
    }).toString()

    return fetch(
      `https://${this.domain}/wiki/rest/api/content?${queryString}`,
      { headers: this.headers }
    )
      .then(response => {
        if (response.status !== 200) {
          throw new Error(`${response.status} ${response.statusText}`)
        }
        return response.json()
      })
      .then(data => data.results[0])
  }

  addPage (pageId, title, markdown) {
    const formatted = Confluence.format(markdown)
    return fetch(`https://${this.domain}/wiki/api/v2/pages`, {
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
      .then(data => data.id)
  }

  updatePage (pageId, version, title, markdown) {
    const formatted = Confluence.format(markdown)
    return fetch(`https://${this.domain}/wiki/api/v2/pages/${encodeURIComponent(pageId)}`, {
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
      .then(data => {
        return data.id
      })
  }

  async addOrReplacePage (title, markdown) {
    this.initCheck()

    const page = await this.getPageByTitle(title)
    if (page) {
      const id = await this.updatePage(page.id, page.version.number + 1, title, markdown)
      log.info(`updated page ${id} "${title}"`)
    } else {
      const newId = await this.addPage(this.startpageid, title, markdown)
      log.info(`added page ${newId} "${title}"`)
    }
  }
}

exports.confluencePages = async function (db, argv) {
  const confluence = new Confluence(argv)
  await confluence.init()

  const catalog = new NuggetCatalog(db, argv.include, argv.exclude, 0)
  await catalog.init()

  const mdChunks = await catalog.getSeamNuggetChunks()

  for (const c of mdChunks) {
    await confluence.addOrReplacePage(c.label, c.chunk)
  }
}
