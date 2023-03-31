import * as React from 'react'
import PropTypes from 'prop-types'
import * as styles from './shortcodes.module.css'

function getBorderStyles (props) {
  if (props.direction === 'inbound') {
    return (props.type === 'passage') ? styles.left : styles.up
  } else if (props.direction === 'outbound') {
    return (props.type === 'passage') ? styles.right : styles.down
  }
  return styles.main
}

function getNuggetStyle (props) {
  if (props.type === 'passage') return styles.passage
  if (props.type === 'seam') return styles.seam
  return styles.nugget
}

function withNuggetPropTypes (Component) {
  Component.propTypes = {
    children: PropTypes.oneOfType([
      PropTypes.object,
      PropTypes.arrayOf(PropTypes.object)
    ]).isRequired,
    source: PropTypes.string.isRequired
  }
  return Component
}

const Nugget = withNuggetPropTypes((props) => {
  const bordered = styles.bordered
  const directionStyle = getBorderStyles(props)
  const nuggetStyle = getNuggetStyle(props)
  const className = `${bordered} ${directionStyle} ${nuggetStyle}`
  return (
    <div className={className}>
      {props.children}
    </div>
  )
})

const Seam = withNuggetPropTypes((props) => {
  const bordered = styles.bordered
  const directionStyle = getBorderStyles(props)
  const className = `${bordered} ${directionStyle} ${styles.seam}`
  return (
    <div className={className}>
      {props.children}
    </div>
  )
})

const Passage = withNuggetPropTypes((props) => {
  const bordered = styles.bordered
  const directionStyle = getBorderStyles(props)
  const className = `${bordered} ${directionStyle} ${styles.passage}`
  return (
    <div className={className}>
      {props.children}
    </div>
  )
})

const NuggetArea = (props) => {
  return <div className={styles.nuggetarea}>{props.children}</div>
}
NuggetArea.propTypes = Nugget.propTypes

const PassagesInbound = (props) => {
  return (
    <div className={styles.inboundpassage}>
      {props.children}
    </div>
  )
}
PassagesInbound.propTypes = Nugget.propTypes

const PassagesOutbound = (props) => {
  return (
    <div className={styles.outboundpassage}>
      {props.children}
    </div>
  )
}
PassagesOutbound.propTypes = Nugget.propTypes

const NuggetsInbound = (props) => {
  return (
    <div className={styles.inboundnugget}>
      {props.children}
    </div>
  )
}
NuggetsInbound.propTypes = Nugget.propTypes

const NuggetsOutbound = (props) => {
  return (
    <div className={styles.outboundnugget}>
      {props.children}
    </div>
  )
}
NuggetsOutbound.propTypes = Nugget.propTypes

export const components = {
  Nugget,
  Seam,
  Passage,
  PassagesInbound,
  PassagesOutbound,
  NuggetsInbound,
  NuggetsOutbound,
  NuggetArea
}
