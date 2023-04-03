/**
 * @type {import('gatsby').GatsbyConfig}
 */

import remarkGfm from 'remark-gfm'

const config = {
  siteMetadata:
  {
    title: '{{{mine_name}}}'
  },
  pathPrefix: '{{{path_prefix}}}',
  plugins: [
    {
      resolve: 'gatsby-plugin-mdx',
      mdxOptions: {
        remarkPlugins: [remarkGfm]
      }
    },
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

export default config
