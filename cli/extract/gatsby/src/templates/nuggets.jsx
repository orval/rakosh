import React from 'react'
import PropTypes from 'prop-types'
import { graphql } from 'gatsby'
import { MDXProvider } from '@mdx-js/react'
import { components } from '../components/shortcodes'

export default function NuggetTemplate ({ children }) {
  return (
    <MDXProvider components={components}>
      {children}
    </MDXProvider>
  )
}

NuggetTemplate.propTypes = {
  children: PropTypes.element.isRequired
}

export const query = graphql`
  query($id: String!) {
    mdx(id: { eq: $id }) {
      id
    }
  }
`
