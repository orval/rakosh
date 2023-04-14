const path = require('path')
const nuggetTemplate = path.resolve('./src/templates/nuggets.jsx')
const seamTemplate = path.resolve('./src/templates/seams.jsx')

exports.createPages = async ({ graphql, actions, reporter }) => {
  const { createPage } = actions

  const result = await graphql(`
  {
    nuggets: allMdx(filter: {frontmatter: {slug: {regex: "/(^nugget|^/$)/"}}}) {
      nodes {
        id
        body
        frontmatter {
          slug
          nuggets
        }
        internal {
          contentFilePath
        }
      }
    }
  }
  `)

  if (result.errors) {
    reporter.panicOnBuild('Error loading MDX result', result.errors)
  }

  const nuggets = result.data.nuggets.nodes

  nuggets.forEach(node => {
    if (node.frontmatter.nuggets) {
      createPage({
        path: node.frontmatter.slug,
        component: `${seamTemplate}?__contentFilePath=${node.internal.contentFilePath}`,
        context: { id: node.id }
      })
    } else {
      createPage({
        path: node.frontmatter.slug,
        component: `${nuggetTemplate}?__contentFilePath=${node.internal.contentFilePath}`,
        context: { id: node.id }
      })
    }
  })
}
