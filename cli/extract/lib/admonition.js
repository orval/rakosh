import { visitParents } from 'unist-util-visit-parents'

// remarkDirective deals with directives in the markdown and this function
// converts those to React Admonition elements
export default function directiveToReactAdmon () {
  return (tree) => {
    visitParents(tree, 'containerDirective', (node, ancestors) => {
      if (node.type === 'containerDirective') {
        let title = ''

        // pull the title from AST generated by :::note[title]
        const children = node.children || (node.children = [])
        if (children.length > 0 &&
        children[0].type === 'paragraph' &&
        children[0].data &&
        children[0].data.directiveLabel &&
        children[0].data.directiveLabel === true &&
        children[0].children &&
        children[0].children.length > 0 &&
        children[0].children[0].type === 'text'
        ) {
          title = ` title="${children[0].children[0].value}"`
          children[0].children.shift()
        }

        // include the Admonition in the children array
        children.unshift({
          type: 'html',
          value: `<Admonition type="${node.name}"${title}>\n`
        })

        children.push({ type: 'html', value: '\n</Admonition>' })

        // replace this containerDirective node with the children elements
        const parent = ancestors[ancestors.length - 1]
        const index = parent.children.indexOf(node)
        parent.children.splice(index, 1, ...children)
      }
    })
  }
}
