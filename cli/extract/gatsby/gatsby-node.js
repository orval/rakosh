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
        }
        internal {
          contentFilePath
        }
      }
    }
    seams: allMdx(filter: {frontmatter: {slug: {regex: "/^seam/"}}}) {
      nodes {
        id
        body
        frontmatter {
          slug
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
    createPage({
      path: node.frontmatter.slug,
      component: `${nuggetTemplate}?__contentFilePath=${node.internal.contentFilePath}`,
      context: { id: node.id }
    })
  })

  const seams = result.data.seams.nodes

  seams.forEach(node => {
    createPage({
      path: node.frontmatter.slug,
      component: `${seamTemplate}?__contentFilePath=${node.internal.contentFilePath}`,
      context: { id: node.id }
    })
  })
}
