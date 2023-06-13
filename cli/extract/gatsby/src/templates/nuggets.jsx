import React from 'react'
import PropTypes from 'prop-types'
import { MDXProvider } from '@mdx-js/react'
import { components } from '../components/shortcodes'
import Admonition from 'react-admonitions'

export default function NuggetTemplate ({ children }) {
  const combinedComponents = { Admonition, ...components }
  return (
    <MDXProvider components={combinedComponents}>
      {children}
    </MDXProvider>
  )
}

NuggetTemplate.propTypes = {
  children: PropTypes.element.isRequired
}
