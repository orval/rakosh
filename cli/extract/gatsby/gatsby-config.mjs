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
      options: {
        mdxOptions: {
          remarkPlugins: [remarkGfm]
        }
      }
    },
    {
      resolve: 'gatsby-source-filesystem',
      options: {
        name: 'nuggets',
        path: './content/'
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
    },
    {
      resolve: 'gatsby-omni-font-loader',
      options: {
        enableListener: true,
        preconnect: ['https://fonts.googleapis.com', 'https://fonts.gstatic.com'],
        web: [
          {
            name: 'Figtree',
            file: 'https://fonts.googleapis.com/css2?family=Figtree&family=Inter&display=swap'
          }
        ]
      }
    }
  ]
}

export default config
