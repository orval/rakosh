import { visitParents } from 'unist-util-visit-parents'

import { Nugget } from '../../lib/nugget.js'

export function rewriteConfluenceLink ({ conf }) {
  return (tree) => {
    visitParents(tree, 'link', (node, ancestors) => {
      const uuid = node.url.slice(1)

      if (Nugget.UUID_RE.test(uuid)) {
        node.url = conf.getLookupUrl(uuid)
      }
    })
  }
}
