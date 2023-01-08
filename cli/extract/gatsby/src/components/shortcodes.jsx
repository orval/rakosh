import * as React from 'react'
import PropTypes from 'prop-types'

const Nugget = (props) => {
  return (
    <>
      {props.children}
      <a href={props.source}>edit</a>
    </>
  )
}

Nugget.propTypes = {
  children: PropTypes.array.isRequired,
  source: PropTypes.string.isRequired
}

const Seam = (props) => {
  return (
    <>
      <p>SEAM: {props._key}</p>
      {props.children}
    </>
  )
}

Seam.propTypes = {
  children: PropTypes.array.isRequired
}

export const components = {
  Nugget,
  Seam
}
