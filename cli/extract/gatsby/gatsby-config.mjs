/**
 * @type {import('gatsby').GatsbyConfig}
 */

import remarkGfm from 'remark-gfm'
import fm from 'front-matter'

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
  '|^<.?Nuggets.{2,3}bound>$' +
  '|^<.?Passages.{2,3}bound>$'
)

// this strips a bunch of internal cruft from what is indexed for search
function prepBody (mdx) {
  const markdown = fm(mdx)
  const lines = markdown.body.split('\n').filter(l => !MDX_RE.test(l.trim()))
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
    }
  ]
}

export default config
