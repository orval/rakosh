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
      .catch(error => console.error('getPage', error))
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
      .catch(error => console.error('getPageByTitle', error))
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
      .catch(error => console.error('addPage', error))
      // .then(data => data.id)
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
      .catch(error => console.error('updatePage', error))
      // .then(data => {
      //   return data.id
      // })
  }

  async deletePage (pageId) {
    return fetch(`https://${this.domain}/wiki/api/v2/pages/${encodeURIComponent(pageId)}`, {
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
      // await this.deletePage(page.id)
      // console.log('Deleted', page.id)
      const updatedPage = await this.updatePage(page.id, page.version.number + 1, title, markdown)
      log.info(`updated page ${updatedPage.id} "${title}"`)
      return updatedPage
    } else {
      const newPage = await this.addPage(parentId, title, markdown)
      log.info(`added page ${newPage.id} "${title}"`)
      return newPage
    }
  }
}

exports.confluencePages = async function (db, argv) {
  const confluence = new Confluence(argv)
  await confluence.init()

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
      console.log('already written', c.key)
      continue
    }

    const pageData = await confluence.addOrReplacePage(parentId, c.label, c.chunk)
    written[c.key] = parentId
    parentId = pageData.id

    if ('children' in c) {
      for (const child of c.children) {
        // console.log('child', child.key)
        const chunk = catalog.getChunk(child.key, child.depth)
        // console.log('WAT', chunk)

        if (!chunk) {
          // console.log('NOPE', child.key)
          continue
        }

        const childData = await confluence.addOrReplacePage(parentId, child.label, chunk)
        written[child.key] = parentId
        // console.log('child _ ', childData.id)
      }
    }
  }
}
