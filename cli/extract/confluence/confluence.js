import assert from 'assert'

import { FormData } from 'formdata-node'
import { fileFromPathSync } from 'formdata-node/file-from-path'
import log from 'loglevel'
// import md2c from '@shogobg/markdown2confluence'
import fnTranslate from 'md-to-adf-dailykos'
import fetch from 'node-fetch'
import _ from 'lodash'
// import { document, emoji, link } from 'adf-builder'
import { Panel } from 'adf-builder'

export class Confluence {
  static ADMON_OPEN = '<Admonition '
  static ADMON_CLOSE = '</Admonition>'

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

  getLookupUrl (key) {
    const urls = this.lookup.get(key)
    if (urls && urls[0]) return urls[0]
    return false
  }

  getLookup () {
    const obj = {}
    for (const [key, value] of this.lookup) {
      obj[key] = value
    }
    return JSON.stringify(obj, null, 2)
  }

  inLookup (key) {
    return this.lookup.has(key)
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

  // static getAdmon (node) {
  //   const content = node.content
  //   // if (content && content.type === 'paragraph' && content.content[0].constructor.name === 'Emoji') console.log('FFFF', content.content.length)
  //   if (content &&
  //     content.type === 'paragraph' &&
  //     content.content[0].constructor.name === 'Text' &&
  //     content.content[0].text === this.ADMON_CLOSE) {
  //     // content.content[0].attrs.shortName === ':') {
  //     return content.content
  //   }
  //   return undefined
  // }

  static isAdmonOpen (node) {
    // const admon = this.getAdmon(node)
    // return (admon && admon.length > 1)
    return (node.content &&
      node.content.type === 'paragraph' &&
      node.content.content[0].constructor.name === 'Text' &&
      node.content.content[0].text.startsWith(this.ADMON_OPEN))
  }

  static isAdmonClose (node) {
    // const admon = this.getAdmon(node)
    // return (admon && admon.length === 1)
    return (node.content &&
      node.content.type === 'paragraph' &&
      node.content.content[0].constructor.name === 'Text' &&
      node.content.content[0].text === this.ADMON_CLOSE)
  }

  // static isAdmonOpen (node) {
  //   return (node.content &&
  //     node.type === 'paragraph' &&
  //     node.content[0].type === 'text' &&
  //     node.content[0].text.startsWith(this.ADMON_OPEN))
  // }

  // static isAdmonClose (node) {
  //   if (node.content && node.type === 'paragraph' && node.content[0].type === 'text') console.log('FFFF', node.content[0])
  //   return (node.type === 'paragraph' &&
  //     node.content[0].type === 'text' &&
  //     node.content[0].text === this.ADMON_CLOSE)
  // }

  static format (markdown) {
    const adfo = fnTranslate(markdown)
    // console.log('adfoO', adfo.content)

    const hasAdmonition = adfo.content.content.filter(c => this.isAdmonClose(c))

    console.log('adfoA', markdown, JSON.stringify(adfo.toJSON(), null, 2))
    if (hasAdmonition.length > 0) {
      let panel = new Panel('warning')
      let inAdmon = false
      let startIdx = 0
      const removeIndexes = []
      adfo.content.content.forEach((node, idx) => {
        if (this.isAdmonOpen(node)) {
          inAdmon = true
          panel = new Panel('warning')
          startIdx = idx
        } else if (this.isAdmonClose(node) && inAdmon) {
          // _.remove(admonNodes)
          inAdmon = false
          adfo.content.content[startIdx] = panel
          removeIndexes.push(idx)
        } else if (inAdmon) {
          panel.content.add(node)
          removeIndexes.push(idx)
        }
      })

      _.pullAt(adfo.content.content, removeIndexes)

      console.log('adfoB', removeIndexes, JSON.stringify(adfo.toJSON(), null, 2))
    }

    return adfo

    // return md2c(markdown, {
    //   codeBlock: {
    //     options: {
    //       title: '' // prevent 'none' title on all the code blocks
    //     }
    //   }
    // })
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
      // expand: 'body.view,version',
      expand: 'body.atlas_doc_format,version',
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
          representation: 'atlas_doc_format',
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
    const foo = JSON.stringify(formatted, null, 2)

    const bod = JSON.stringify({
      id: pageId,
      spaceId: this.spaceId,
      status: 'current',
      title,
      body: {
        representation: 'atlas_doc_format',
        value: String(foo)
      },
      version: {
        number: version
      }
    })

    console.log(foo)

    return fetch(`${this.wiki}/api/v2/pages/${encodeURIComponent(pageId)}`, {
      method: 'PUT',
      headers: this.headers,
      body: bod
      // body: JSON.stringify({
      //   id: pageId,
      //   spaceId: this.spaceId,
      //   status: 'current',
      //   title,
      //   body: {
      //     representation: 'atlas_doc_format',
      //     value: formatted
      //   },
      //   version: {
      //     number: version
      //   }
      // })
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

  async addOrReplacePage (parentId, nugget, title) {
    this.initCheck()
    assert.ok(parentId)
    const markdown = nugget.page
    if (!markdown) return

    const page = await this.getPageByTitle(title)
    if (page) {
      const updatedPage = await this.updatePage(
        page.id,
        page.version.number + 1,
        title,
        markdown
      )

      log.info(`updated page ${updatedPage.id} "${title}"`)

      // TODO do this for `add` as well
      for (const [uuidName, media] of Object.entries(nugget.refs)) {
        await this.attach(updatedPage.id, uuidName, media)
        log.info(`attached ${uuidName} to page ${updatedPage.id}`)
      }

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
    for (const p of pages.results.filter(d => Number(d.parentId) === this.startpageid)) {
      log.info(`deleting page ${p.id}`)
      await this.deletePage(p.id)
    }
  }
}
