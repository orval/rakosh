const fetch = (...args) => import('node-fetch').then(({ default: fetch }) => fetch(...args))
const log = require('loglevel')
const { aql } = require('arangojs/aql')
const { Nugget } = require('../../lib/nugget')
const md2c = require('@shogobg/markdown2confluence')

const domain = 'orval.atlassian.net'

exports.confluencePages = async function (db, argv) {
  if (!process.env.RAKOSH_CC_AUTH) {
    log.error('RAKOSH_CC_AUTH not set in the environment')
    log.error('RAKOSH_CC_AUTH requires Confluence Cloud credentials in format <your_email@domain.com>:<your_user_api_token>')
    return
  }

  const headers = {
    Authorization: `Basic ${Buffer.from(process.env.RAKOSH_CC_AUTH).toString('base64')}`,
    // Authorization: `Basic `,
    Accept: 'application/json',
    'Content-Type': 'application/json'
  }

  const spaceId = await getSpaceId(headers, argv.spacekey)

  db.query(aql`FOR doc IN passage FILTER doc._key == 'adit' RETURN doc`)
    .then(cursor => cursor.next())
    .then(n => new Nugget(n, n.body))
    .then(nugget => postPage(headers, spaceId, argv.pageid, nugget))
}

function getSpaces (headers, key) {
  const queryString = new URLSearchParams({ keys: [key] }).toString()
  return fetch(`https://${domain}/wiki/api/v2/spaces?${queryString}`, { headers })
    .then(response => {
      if (response.status !== 200) throw new Error(`${response.status} ${response.statusText}`)
      return response.text()
    })
    .then(j => JSON.parse(j).results)
}

async function getSpaceId (headers, key) {
  try {
    const spaces = await getSpaces(headers, key)
    if (spaces.length === 1) {
      return spaces[0].id
    }
    log.error(`Space ${key} not found`)
  } catch (error) {
    log.error(`Could not retrieve Confluence spaces [${error}]`)
  }
  process.exit(1)
}

function postPage (headers, spaceId, pageId, nugget) {
  return fetch(`https://${domain}/wiki/api/v2/pages`, {
    method: 'POST',
    headers,
    body: JSON.stringify({
      spaceId,
      status: 'current',
      title: nugget.label,
      parentId: pageId,
      body: {
        representation: 'wiki',
        value: md2c(nugget.body)
      }
    })
  }).then(response => {
    console.log(`Response: ${response.status} ${response.statusText}`)
    return response.text()
  })
    .then(text => console.log(text))
    .catch(err => console.error(err))
}
