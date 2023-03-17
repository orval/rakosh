/**
 * @type {import('gatsby').GatsbyConfig}
 */
module.exports = {
  siteMetadata:
  {
    title: 'Extracted Gatsby Mine'
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
    }
  ]
}
