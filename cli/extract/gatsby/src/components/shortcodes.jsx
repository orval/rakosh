import * as React from 'react'
import PropTypes from 'prop-types'
import * as styles from './shortcodes.module.css'

function getStyle (props) {
  function getDirection (props) {
    if ('direction' in props) {
      if (props.direction === 'inbound') {
        return (props.type === 'passage') ? styles.left : styles.up
      } else if (props.direction === 'outbound') {
        return (props.type === 'passage') ? styles.right : styles.down
      }
    }
    return styles.main
  }
  let nugStyle = styles.nugget
  if (props.type === 'passage') nugStyle = styles.passage
  else if (props.type === 'seam') nugStyle = styles.seam
  return `${getDirection(props)} ${nugStyle}`
}

const Nugget = (props) => {
  return (
    <div className={getStyle(props)}>
      {props.children}
      {/* <a href={props.source}>edit</a> */}
    </div>
  )
}

Nugget.propTypes = {
  children: PropTypes.oneOfType([
    PropTypes.object,
    PropTypes.arrayOf(PropTypes.object)
  ]).isRequired,
  source: PropTypes.string.isRequired
}

const Seam = (props) => {
  return (
    <div className={getStyle(props)}>
      {props.children}
    </div>
  )
}

Seam.propTypes = Nugget.propTypes

const Passage = (props) => {
  return (
    <div className={getStyle(props)}>
      {props.children}
    </div>
  )
}

Passage.propTypes = Nugget.propTypes

export const components = {
  Nugget,
  Seam,
  Passage
}
