import { visitParents } from 'unist-util-visit-parents'

import { Nugget } from '../../lib/nugget.js'

// rewrite links that are like [text](/<uuid>) to use a hash
export default function rewriteLink ({ allNuggets }) {
  return (tree) => {
    visitParents(tree, 'link', (node, ancestors) => {
      const uuid = node.url.slice(1)
      if (!Nugget.UUID_RE.test(uuid) || !(uuid in allNuggets)) return

      const url = node.url
      node.url = '#' + (url.startsWith('/') ? url.slice(1) : url)
    })
  }
}
