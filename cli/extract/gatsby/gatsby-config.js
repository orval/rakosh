/**
 * @type {import('gatsby').GatsbyConfig}
 */
module.exports = {
  siteMetadata:
  {
    title: '{{{mine_name}}}'
  },
  pathPrefix: '{{{path_prefix}}}',
  plugins: [
    'gatsby-plugin-mdx',
    {
      resolve: 'gatsby-source-filesystem',
      options: {
        name: 'nuggets',
        path: './content/nuggets/'
      }
    },
    {
      resolve: 'gatsby-source-filesystem',
      options: {
        name: 'seams',
        path: './content/seams/'
      }
    },
    {
      resolve: 'gatsby-plugin-local-search',
      options: {
        name: 'prospect',
        engine: 'flexsearch',
        query: `{
          allMdx {
            nodes {
              id
              body
              frontmatter {
                slug
                label
              }
              internal {
                contentFilePath
              }
            }
          }
        }`,
        ref: 'id',
        normalizer: ({ data }) =>
          data.allMdx.nodes.map((node) => ({
            id: node.id,
            slug: node.frontmatter.slug,
            label: node.frontmatter.label,
            body: node.body
          }))
      }
    }
  ]
}
