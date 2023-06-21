import * as React from 'react'
import { useLocation } from '@reach/router'
import { navigate } from 'gatsby'
import slugLookup from '../../content/slug_lookup.json'

const SlugNav = () => {
  const path = useLocation().pathname.replace(/\/$/, '')

  if (path in slugLookup) {
    navigate(slugLookup[path])
  }

  return (
    <h1>Nugget not found</h1>
  )
}

export default SlugNav
