/**
 * @type {import('gatsby').GatsbyConfig}
 */
module.exports = {
  siteMetadata:
  {
    title: 'Extracted Gatsby Mine'
  },
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
