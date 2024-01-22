import { MDXProvider } from '@mdx-js/react'
import PropTypes from 'prop-types'
import React from 'react'
import Admonition from 'react-admonitions'

import { components } from '../components/shortcodes'

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
