const path = require('path')
const nuggetTemplate = path.resolve('./src/templates/nuggets.jsx')

exports.createPages = async ({ graphql, actions, reporter }) => {
  const { createPage } = actions

  const result = await graphql(`
  {
    nuggets: allMdx {
      nodes {
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
  const slugs = {}

  nuggets.forEach(node => {
    if (node.frontmatter.slug in slugs) {
      console.error(`slug [${node.frontmatter.slug}] already exists -- processing file [${node.internal.contentFilePath}]`)
    }
    createPage({
      path: node.frontmatter.slug,
      component: `${nuggetTemplate}?__contentFilePath=${node.internal.contentFilePath}`
    })
    slugs[node.frontmatter.slug] = 1
  })
}

// generating source maps blows the heap so they are disabled
exports.onCreateWebpackConfig = ({
  stage,
  rules,
  loaders,
  plugins,
  actions
}) => {
  if (stage === 'build-html') {
    actions.setWebpackConfig({
      devtool: false
    })
  }
}
