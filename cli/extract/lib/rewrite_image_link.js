import { readFileSync } from 'node:fs'
import { extname } from 'node:path'

import { visitParents } from 'unist-util-visit-parents'

import { Nugget } from '../../lib/nugget.js'

// rewrite image links that are like ![text](./<uuid>) to include the image extension
// and save reference information about them for later rendering
export default function rewriteImageLink ({ allNuggets, key, embed = false }) {
  return (tree) => {
    visitParents(tree, 'image', (node, ancestors) => {
      const uuid = node.url.slice(1)
      if (!Nugget.UUID_RE.test(uuid) || !(uuid in allNuggets)) return

      const mediaObj = allNuggets[uuid].__media
      if (mediaObj) {
        if (embed) {
          // embed the image into a `data:` link
          node.url = 'data:image/png;base64,' + readFileSync(mediaObj.relpath).toString('base64')
        } else {
          // rewrite the required UUID URL to include the media file extension and remove the leading slash
          const url = node.url + extname(mediaObj.path)
          node.url = url.startsWith('/') ? url.slice(1) : url
        }

        const uuidName = uuid + extname(mediaObj.path)
        allNuggets[key].refs[uuidName] = mediaObj
      }
    })
  }
}
