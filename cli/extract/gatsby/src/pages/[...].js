import { navigate } from 'gatsby'
import * as React from 'react'
import { useLocation } from '@reach/router'

import slugLookup from '../../content/slug_lookup.json'

function stripPathPrefix (path) {
  // pathPrefix from config does not appear in generated paths so remove it
  const pathPrefix = '{{{path_prefix}}}'

  if (pathPrefix === '/') return path // do not strip leading slash

  if (path.startsWith(pathPrefix)) {
    return path.substring(pathPrefix.length)
  }
  return path
}

const SlugNav = () => {
  const path = stripPathPrefix(useLocation().pathname.replace(/\/$/, ''))

  if (path in slugLookup) {
    navigate(slugLookup[path])
  }

  return (
    <h1>Nugget not found</h1>
  )
}

export default SlugNav
