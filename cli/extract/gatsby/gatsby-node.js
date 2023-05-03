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

  nuggets.forEach(node => {
    createPage({
      path: node.frontmatter.slug,
      component: `${nuggetTemplate}?__contentFilePath=${node.internal.contentFilePath}`
    })
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
