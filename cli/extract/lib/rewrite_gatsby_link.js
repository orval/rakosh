import { visitParents } from 'unist-util-visit-parents'

import { Nugget } from '../../lib/nugget.js'

// rewrite links that are like [text](./<uuid>) to use the Gatsby Link API
export default function rewriteGatsbyLink ({ allNuggets, key }) {
  return (tree) => {
    visitParents(tree, 'link', (node, ancestors) => {
      const uuid = node.url.slice(1)
      if (!Nugget.UUID_RE.test(uuid) || !(uuid in allNuggets)) return

      // check there is a child text node
      if (node.children && node.children.length > 0 && node.children[0].type === 'text') {
        // change this node to an HTML node and insert a Gatsby Link
        node.type = 'html'
        node.value = `<Link to="${node.url}">${node.children[0].value}</Link>`
        delete node.children
      }
    })
  }
}
