/**
 * @type {import('gatsby').GatsbyConfig}
 */

import remarkGfm from 'remark-gfm'

const MDX_RE = new RegExp(
  '^<.?NuggetArea>$' +
  '|^<.?NuggetBody>$' +
  '|^<.?Breadcrumbs>$' +
  '|^<.?Crumbs>$' +
  '|^<Nugget .*>$' +
  '|^<Seam .*>$' +
  '|^<Passage .*>$' +
  '|^<Crumb .*>$' +
  '|^<.Nugget>$' +
  '|^<.Passage>$' +
  '|^<.Crumbs>$' +
  '|^<.Seam>$' +
  '|^<.?Nuggets.{2,3}bound>$' +
  '|^<.?Passages.{2,3}bound>$'
)

// this strips a bunch of internal cruft from what is indexed for search
function prepBody (mdx) {
  const markdown = mdx.replace(/^<NuggetsInbound>$[\s\S]*/m, '')
  const lines = markdown.split('\n').filter(l => !MDX_RE.test(l.trim()))
  return lines.join('\n')
}

const config = {
  siteMetadata:
  {
    title: '{{{mine_name}}}'
  },
  pathPrefix: '{{{path_prefix}}}',
  plugins: [
    'gatsby-plugin-layout',
    {
      resolve: 'gatsby-plugin-mdx',
      options: {
        mdxOptions: {
          remarkPlugins: [remarkGfm]
        },
        gatsbyRemarkPlugins: [
          {
            resolve: 'gatsby-remark-images',
            options: {
              maxWidth: 650
            }
          },
          'gatsby-plugin-sharp'
        ]
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
        index: ['label', 'body'],
        store: ['id', 'slug', 'label'],
        normalizer: ({ data }) =>
          data.allMdx.nodes.map((node) => ({
            id: node.id,
            slug: node.frontmatter.slug,
            label: node.frontmatter.label,
            body: prepBody(node.body)
          }))
      }
    },
    {
      resolve: 'gatsby-plugin-manifest',
      options: {
        name: '{{{mine_name}}}',
        short_name: '{{{mine_name}}}',
        start_url: '{{{path_prefix}}}',
        background_color: '#f7f0eb',
        theme_color: '#a2466c',
        display: 'standalone',
        icon: 'src/images/icon.png',
        icon_options: {
          purpose: 'any maskable'
        }
      }
    },
    'gatsby-plugin-offline'
  ]
}

export default config
