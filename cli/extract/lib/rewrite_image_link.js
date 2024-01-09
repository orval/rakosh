const { extname } = require('node:path')

const { visitParents } = require('unist-util-visit-parents')

const { Nugget } = require('../../lib/nugget')

// rewrite image links that are like ![text](./<uuid>) to include the image extension
// and save reference information about them for later rendering
exports.rewriteImageLink = function ({ allNuggets, key }) {
  return (tree) => {
    visitParents(tree, 'image', (node, ancestors) => {
      if (!Nugget.UUID_RE.test(node.url) || !(node.url in allNuggets)) return

      const mediaObj = allNuggets[node.url].__media
      if (mediaObj) {
        // rewrite the required UUID URL to include the media file extension
        node.url = node.url + extname(mediaObj.path)
        allNuggets[key].refs[node.url] = mediaObj
      }
    })
  }
}
