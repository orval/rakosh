import assert from 'assert'

import { FormData } from 'formdata-node'
import { fileFromPathSync } from 'formdata-node/file-from-path'
import log from 'loglevel'
import fnTranslate from 'md-to-adf-orval'
import fetch from 'node-fetch'
import _ from 'lodash'
import { extension, panel, rule } from '@atlaskit/adf-utils/dist/cjs/builders.js'

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
      log.error(`Could not retrieve Confluence spaces [${error.message}]`)
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

  static getParaText (node) {
    if (node.content &&
      node.type === 'paragraph' &&
      node.content.length > 0 &&
      node.content[0].type === 'text') {
      return node.content[0].text
    }
    return undefined
  }

  static isAdmonOpen (node) {
    const text = this.getParaText(node)
    return (text && text.startsWith(this.ADMON_OPEN))
  }

  static isAdmonClose (node) {
    const text = this.getParaText(node)
    return (text && text === this.ADMON_CLOSE)
  }

  static getAdmonType (node) {
    const text = this.getParaText(node)
    if (text) {
      const match = text.match(/type="([^"]+)"/)
      if (match && match.length > 1) {
        // convert directive type to panel type
        switch (match[1]) {
          case 'warning':
            return 'warning'
          case 'tip':
            return 'info'
          case 'caution':
            return 'error'
          case 'note':
            return 'note'
          case 'important':
            return 'success'
          case 'question':
            return 'info'
          default:
            return 'note'
        }
      }
    }
    return 'note'
  }

  static format (markdown, attachments) {
    const adfo = fnTranslate(markdown)

    // replace the filename "titles" with the attachment IDs
    if (attachments?.length) {
      function getAttachmentId (id) {
        const matched = attachments.filter(a => a.title === id)
        if (matched?.length && matched[0]?.fileId) return matched[0]?.fileId
      }

      function setImageIds (node) {
        if (Array.isArray(node)) {
          node.forEach(setImageIds)
        } else if (node && typeof node === 'object') {
          if (node.type === 'media' && node.attrs && node.attrs.id) {
            node.attrs.id = getAttachmentId(node.attrs.id)
          }
          if (node.content) {
            setImageIds(node.content)
          }
        }
      }

      setImageIds(adfo)
    }

    const hasAdmonition = adfo.content.filter(c => this.isAdmonClose(c))

    // React Admonition elements are replaced by an ADF Panel
    if (hasAdmonition.length > 0) {
      let panelType
      let admonContent
      let startIdx = 0
      const removeIndexes = []
      adfo.content.forEach((node, idx) => {
        if (this.isAdmonOpen(node)) {
          admonContent = []
          panelType = this.getAdmonType(node)
          startIdx = idx
        } else if (this.isAdmonClose(node) && admonContent) {
          adfo.content[startIdx] = panel({ panelType })(...admonContent)
          removeIndexes.push(idx)
          admonContent = undefined
        } else if (admonContent) {
          admonContent.push(node)
          removeIndexes.push(idx)
        }
      })
      _.pullAt(adfo.content, removeIndexes)
    }

    // append the Children Display macro after a rule
    adfo.content.push(rule())
    adfo.content.push(extension({
      extensionKey: 'children',
      extensionType: 'com.atlassian.confluence.macro.core'
    }))

    return adfo
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
      .catch(error => log.error('getPage', error.message))
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
      .catch(error => log.error('getPages', error.message))
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
      .catch(error => log.error('getPageByTitle', error.message))
  }

  getAttachments (pageId) {
    const queryString = new URLSearchParams({
      status: 'current',
      limit: 250
    }).toString()

    return fetch(`${this.wiki}/api/v2/pages/${encodeURIComponent(pageId)}/attachments?${queryString}`, {
      method: 'GET',
      headers: this.headers
    })
      .then(response => {
        if (response.status !== 200) {
          throw new Error(`${response.status} ${response.statusText}`)
        }
        return response.json()
      })
      .then(data => data.results)
      .catch(error => log.error('getPages', error.message))
  }

  addPage (pageId, title, markdown) {
    const formatted = Confluence.format(markdown)

    const body = JSON.stringify({
      spaceId: this.spaceId,
      status: 'current',
      title,
      parentId: pageId,
      body: {
        representation: 'atlas_doc_format',
        value: String(JSON.stringify(formatted))
      }
    })

    return fetch(`${this.wiki}/api/v2/pages`, {
      method: 'POST',
      headers: this.headers,
      body
    })
      .then(response => {
        if (response.status !== 200) {
          throw new Error(`${response.status} ${response.statusText}`)
        }
        return response.json()
      })
      .catch(error => log.error('addPage', error.message))
  }

  updatePage (pageId, version, title, markdown, attachments) {
    const formatted = Confluence.format(markdown, attachments)

    const body = JSON.stringify({
      id: pageId,
      spaceId: this.spaceId,
      status: 'current',
      title,
      body: {
        representation: 'atlas_doc_format',
        value: String(JSON.stringify(formatted, null, 2))
      },
      version: {
        number: version
      }
    })

    return fetch(`${this.wiki}/api/v2/pages/${encodeURIComponent(pageId)}`, {
      method: 'PUT',
      headers: this.headers,
      body
    })
      .then(response => {
        if (response.status !== 200) {
          throw new Error(`${response.status} ${response.statusText}`)
        }
        return response.json()
      })
      .catch(error => log.error('updatePage', error.message))
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
      .catch(error => log.error('deletePage', error.message))
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
      .then(data => {
        return data.results[0]
      })
      .catch(error => log.error('attach', error.message))
  }

  async addOrReplacePage (parentId, nugget, title) {
    this.initCheck()
    assert.ok(parentId)
    const markdown = nugget.page
    if (!markdown) return

    const page = await this.getPageByTitle(title)
    if (page) {
      // gather data on any attachments
      const attachments = await this.getAttachments(page.id)

      const updatedPage = await this.updatePage(
        page.id,
        page.version.number + 1,
        title,
        markdown,
        attachments
      )

      if (!updatedPage) {
        log.error(`failed to update page "${title}"`)
        return
      }

      log.info(`updated page ${updatedPage.id} "${title}"`)

      // skip attachments if any were found -- delete the page to change the attachments
      if (attachments?.length) return updatedPage

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
